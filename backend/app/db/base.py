from app.db.mongo import init_mongo


async def init_db() -> None:
    await init_mongo()
