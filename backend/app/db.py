from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import settings

if settings.database_url in ("sqlite://", "sqlite:///:memory:"):
    # Tymczasowa warstwa w pamięci RAM backendu — nie tworzy żadnego pliku bazy na dysku
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
elif settings.database_url.startswith("sqlite"):
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_NO_OVERLAP_DDL = """
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_overlap') THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_no_overlap
      EXCLUDE USING gist (table_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
      WHERE (status = 'confirmed');
  END IF;
END $$;
"""


def init_db() -> None:
    from .models import Table

    Base.metadata.create_all(engine)
    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
            conn.execute(text(_NO_OVERLAP_DDL))
    if settings.seed_demo:
        # Inicjalizujemy wyłącznie puste stoliki układu sali (0 rezerwacji, 0 odczytów z kamer)
        with SessionLocal() as db:
            if db.scalar(select(func.count(Table.id))) == 0:
                bistro_zones = [
                    "Witryna Okienna",
                    "Witryna Okienna",
                    "Rotunda Pod Kopułą",
                    "Przy Winiarni",
                    "Rotunda Pod Kopułą",
                    "Centrum Kopuły",
                ]
                bistro_seats = [2, 2, 4, 4, 6, 8]
                demo_tables = [
                    Table(
                        restaurant_id="bistro-agh",
                        name=f"Stolik {i}",
                        seats=s,
                        zone=z,
                    )
                    for i, (s, z) in enumerate(zip(bistro_seats, bistro_zones), 1)
                ]

                trattoria_spec = [
                    ("Stolik 1", 2, "Arkada Włoska"),
                    ("Stolik 2", 2, "Arkada Włoska"),
                    ("Stolik 3", 4, "Blisko Pieca"),
                    ("Stolik 4", 4, "Szachownica Środek"),
                    ("Stolik 5", 6, "Pergola Winorośli"),
                    ("Stolik 6", 8, "Stół Biesiadny La Famiglia"),
                ]
                demo_tables.extend(
                    Table(restaurant_id="trattoria-roma", name=n, seats=s, zone=z)
                    for n, s, z in trattoria_spec
                )

                sushi_spec = [
                    ("Boks 1", 2, "Przy Barze Sushi"),
                    ("Boks 2", 2, "Przy Barze Sushi"),
                    ("Stolik 3", 4, "Aleja Lampionów"),
                    ("Stolik 4", 4, "Ogród Bambusowy"),
                    ("Stolik 5", 6, "Mata Tatami Wschód"),
                    ("Stolik 6", 8, "Prywatna Sala Omakase"),
                ]
                demo_tables.extend(
                    Table(restaurant_id="sushi-zen", name=n, seats=s, zone=z)
                    for n, s, z in sushi_spec
                )

                db.add_all(demo_tables)
                db.commit()
