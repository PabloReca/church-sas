.PHONY: k kill

k: kill

kill:
	@echo "Killing processes on ports 3000 and 8000..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No process on port 3000"
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || echo "No process on port 8000"
