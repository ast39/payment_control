.PHONY: help install start-frontend start-backend start create-user install-deps migrate reinit-db fix-recurring

help: ## Показать справку по командам
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: install-deps migrate ## Установить все зависимости и запустить миграцию
	@echo "Установка зависимостей завершена"

install-deps: ## Установить зависимости для фронта и бэка
	@echo "Устанавливаю зависимости для фронта..."
	@cd frontend && yarn install
	@echo "Устанавливаю зависимости для бэка..."
	@cd backend && yarn install
	@echo "Инициализирую базу данных..."
	@cd backend && yarn run init-db

start-frontend: ## Запустить фронтенд
	@echo "Запускаю фронтенд..."
	@cd frontend && yarn start

start-backend: ## Запустить бэкенд
	@echo "Запускаю бэкенд..."
	@cd backend && yarn run dev

start: ## Запустить и фронт и бэк (в разных терминалах)
	@echo "Запускаю фронт и бэк..."
	@echo "Фронт будет доступен на http://localhost:3000"
	@echo "Бэк будет доступен на http://localhost:3001"
	@echo "Используй 'make start-frontend' и 'make start-backend' в разных терминалах"

create-user: ## Создать нового пользователя
	@echo "Создаю нового пользователя..."
	@cd backend && node src/scripts/createUser.js

migrate: ## Запустить миграцию базы данных
	@echo "Запускаю миграцию базы данных..."
	@cd backend && node src/database/migrate.js

reinit-db: ## Пересоздать базу данных
	@echo "Пересоздаю базу данных..."
	@rm -f backend/payments.db
	@cd backend && node src/database/init.js

fix-recurring: ## Исправить регулярные платежи
	@echo "Исправляю регулярные платежи..."
	@cd backend && node src/scripts/fixRecurringPayments.js
