import asyncio
import json
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class NotificationHub:
    def __init__(self) -> None:
        self.connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self.lock:
            self.connections[user_id].add(websocket)

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        async with self.lock:
            if user_id in self.connections and websocket in self.connections[user_id]:
                self.connections[user_id].remove(websocket)
                if not self.connections[user_id]:
                    del self.connections[user_id]

    async def push(self, user_id: int, payload: dict[str, Any]) -> None:
        async with self.lock:
            websockets = list(self.connections.get(user_id, set()))
        dead = []
        text = json.dumps(payload, ensure_ascii=False)
        for ws in websockets:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(user_id, ws)


notification_hub = NotificationHub()
