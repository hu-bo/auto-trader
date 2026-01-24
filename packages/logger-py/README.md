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
| `NODE_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `LOG_DIR` | `logs` | Log directory (production only) |

## Development vs Production

**Development (`NODE_ENV=development`):**
- Colorized console output
- Human-readable format

**Production (`NODE_ENV=production`):**
- JSON structured logs
- Daily rotation at midnight
- 30 days retention
- Gzip compression
- Async writing
