from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any
from urllib import error, request

from app.core.config import Settings


@dataclass(slots=True)
class AssistantReply:
    answer: str
    provider: str
    model: str
    used_live_model: bool
    request_id: str | None = None
    warning: str | None = None


class CopilotAssistantService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def respond(
        self,
        *,
        messages: list[dict[str, str]],
        incident_context: dict[str, Any],
        triage_context: dict[str, Any],
        provider_label: str,
        api_base_url: str,
        api_key: str,
        model: str,
        system_prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> AssistantReply:
        resolved_provider = (provider_label or self._settings.ai_provider_label).strip() or "OpenAI-compatible"
        resolved_base = (api_base_url or self._settings.ai_api_base_url).strip()
        resolved_key = (api_key or self._settings.ai_api_key).strip()
        resolved_model = (model or self._settings.ai_model).strip()
        resolved_prompt = (system_prompt or self._settings.ai_system_prompt).strip()

        prepared_messages = self._build_messages(
            messages=messages,
            incident_context=incident_context,
            triage_context=triage_context,
            system_prompt=resolved_prompt,
        )

        if resolved_base and resolved_key and resolved_model:
            try:
                answer, request_id = self._request_chat_completion(
                    api_base_url=resolved_base,
                    api_key=resolved_key,
                    model=resolved_model,
                    messages=prepared_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return AssistantReply(
                    answer=answer,
                    provider=resolved_provider,
                    model=resolved_model,
                    used_live_model=True,
                    request_id=request_id,
                )
            except RuntimeError as exc:
                return AssistantReply(
                    answer=self._fallback_answer(messages, incident_context, triage_context),
                    provider=resolved_provider,
                    model=resolved_model or "demo-fallback",
                    used_live_model=False,
                    warning=str(exc),
                )

        return AssistantReply(
            answer=self._fallback_answer(messages, incident_context, triage_context),
            provider=resolved_provider,
            model=resolved_model or "demo-fallback",
            used_live_model=False,
            warning="No live model credentials were provided, so the assistant responded in demo mode.",
        )

    def _build_messages(
        self,
        *,
        messages: list[dict[str, str]],
        incident_context: dict[str, Any],
        triage_context: dict[str, Any],
        system_prompt: str,
    ) -> list[dict[str, str]]:
        context_blob = json.dumps(
            {
                "incident_context": incident_context,
                "triage_context": triage_context,
            },
            indent=2,
        )
        built_messages = [
            {
                "role": "system",
                "content": (
                    f"{system_prompt}\n\n"
                    "You are operating inside an incident response workspace. Use the context below to stay grounded.\n"
                    f"{context_blob}"
                ),
            }
        ]
        for message in messages[-10:]:
            role = message.get("role", "user")
            content = message.get("content", "").strip()
            if role not in {"system", "user", "assistant"} or not content:
                continue
            built_messages.append({"role": role, "content": content})
        return built_messages

    def _request_chat_completion(
        self,
        *,
        api_base_url: str,
        api_key: str,
        model: str,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> tuple[str, str | None]:
        endpoint = api_base_url.rstrip("/")
        if not endpoint.endswith("/chat/completions"):
            endpoint = f"{endpoint}/chat/completions"

        payload = json.dumps(
            {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        ).encode("utf-8")

        http_request = request.Request(
            endpoint,
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with request.urlopen(http_request, timeout=self._settings.ai_request_timeout_seconds) as response:
                data = json.loads(response.read().decode("utf-8"))
                request_id = response.headers.get("x-request-id") or data.get("id")
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Live model request failed with {exc.code}: {body[:240]}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Live model request could not reach the provider: {exc.reason}") from exc

        answer = self._extract_content(data)
        if not answer:
            raise RuntimeError("Live model response did not include assistant text.")
        return answer, request_id

    def _extract_content(self, payload: dict[str, Any]) -> str:
        choices = payload.get("choices") or []
        if not choices:
            return ""

        message = choices[0].get("message") or {}
        content = message.get("content", "")
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    parts.append(str(item.get("text", "")).strip())
            return "\n".join(part for part in parts if part).strip()

        return ""

    def _fallback_answer(
        self,
        messages: list[dict[str, str]],
        incident_context: dict[str, Any],
        triage_context: dict[str, Any],
    ) -> str:
        latest_user_message = ""
        for message in reversed(messages):
            if message.get("role") == "user" and message.get("content"):
                latest_user_message = str(message["content"]).strip()
                break

        incident_title = incident_context.get("title") or "the current incident"
        severity = triage_context.get("severity") or incident_context.get("severity") or "SEV2"
        likely_owners = ", ".join(triage_context.get("likely_owners") or []) or "service owner, SRE lead, and release operations"
        actions = triage_context.get("action_plan") or []
        first_actions = "\n".join(f"- {item}" for item in actions[:3]) or (
            "- Confirm blast radius and freeze risky rollout activity.\n"
            "- Validate the critical downstream dependencies before widening mitigation.\n"
            "- Draft the next leadership and support update with a precise cadence."
        )
        leadership_update = triage_context.get("leadership_update") or (
            "We have contained the first response, engaged the relevant owners, and are preparing the next checkpoint."
        )

        return (
            f"I am answering in demo mode for {incident_title}.\n\n"
            f"Your request: {latest_user_message or 'Provide operator guidance.'}\n\n"
            f"Assessment:\n"
            f"- Current severity: {severity}\n"
            f"- Likely owners: {likely_owners}\n"
            f"- Best posture: keep the response grounded, reversible, and easy to communicate\n\n"
            f"Recommended next actions:\n{first_actions}\n\n"
            f"Suggested stakeholder line:\n"
            f"{leadership_update}"
        )
