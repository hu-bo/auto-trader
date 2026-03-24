# hquant-logger

High-performance structured logger for hquant Python services.

## Installation

```bash
pip install hquant-logger
```

## Usage

```python
from hquant_logger import create_logger

# Create service-level logger
logger = create_logger('my-service')

# Basic logging
logger.info('Service started')
logger.error('Something went wrong', error_code=500)

# Create child loggers for different modules
db_logger = logger.child('database')
api_logger = logger.child('api')

db_logger.info('Connected to database')
api_logger.info('Request received', method='GET', path='/users')
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `APP_ENV` / `NODE_ENV` | `development` | Runtime environment. `NODE_ENV` has higher priority when both are set |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `LOG_DIR` | `logs` | Log directory for file sink |
| `LOG_TO_FILE` | auto | Force file logging: `true/false` (`auto`: production on, development off) |

## Development vs Production

**Development (`APP_ENV=development` or `NODE_ENV=development`):**
- Colorized console output
- Human-readable format
- File sink can be enabled with `LOG_TO_FILE=true`

**Production (`APP_ENV=production` or `NODE_ENV=production`):**
- JSON structured logs
- Daily rotation at midnight
- 30 days retention
- Gzip compression
- Async writing
