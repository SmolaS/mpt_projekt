DB ?= postgresql://app:app@localhost:5432/reservations
PSQL = psql "$(DB)" -v ON_ERROR_STOP=1 -q

.PHONY: migrate seed test reset

migrate:
	for f in migrations/*.sql; do echo "== $$f"; $(PSQL) -f $$f || exit 1; done

seed:
	$(PSQL) -f seed.sql

test:
	psql "$(DB)" -v ON_ERROR_STOP=1 -f tests/run_tests.sql

# Uwaga: kasuje wszystko w schemacie public.
reset:
	$(PSQL) -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	$(MAKE) migrate seed
