.PHONY: db-up db-down migrate build deploy

db-up:
	docker-compose up -d postgres

db-down:
	docker-compose down

migrate:
	@echo "Run migrations manually or via Go code"

build-backend:
	cd go && CGO_ENABLED=0 GOOS=linux go build -o ../bin/ciclo-norte-server ./cmd/main.go

build-frontend:
	cd web && npm run build

build: build-backend build-frontend

deploy:
	@echo "Deploy to VPS: make build then scp bin/ and web/dist/"
