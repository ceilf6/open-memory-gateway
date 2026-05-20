# Feishu Adapter Notes

The first Feishu integration should preserve the same capture and review flow:

1. User sends, forwards, or submits content from Feishu.
2. Adapter calls `capture_memory` or the same core capture boundary.
3. Memory enters `draft`.
4. User reviews in the Web UI or via a Feishu confirmation surface.
5. Approved memory becomes `active`.

## Client And Mobile Direction

Client and mobile support should prefer message-level actions, bot forwarding, or an in-Feishu web form. The MVP does not assume arbitrary selected text can open a custom native menu in Feishu clients.

## Adapter Boundary

Adapters should only translate external events into `CaptureMemoryInput` and return the resulting memory id and status. They should not own storage, duplicate detection, or approval policy.

## Suggested MVP

- Feishu bot command or message shortcut captures the message text.
- Optional web form receives pasted or shared text from mobile.
- Web UI remains the review and edit surface for drafts.
