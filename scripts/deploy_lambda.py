#!/usr/bin/env python3
"""
Simple deployment script for Ana Alexa Skill (Node/TypeScript)
- Builds the project (npm run build)
- Creates a ZIP containing the compiled dist/
- Uploads to AWS Lambda using AWS CLI

Requirements:
- AWS CLI configured (aws configure)
- Python 3.9+
- Node.js for the build step
- Optional: python-dotenv to load .env (best-effort)
"""

import os
import sys
import subprocess
import tempfile
import zipfile
import shutil
from pathlib import Path

# Optional dotenv
try:
    from dotenv import load_dotenv  # type: ignore
except Exception:  # pragma: no cover
    def load_dotenv(*_args, **_kwargs):  # type: ignore
        return False

ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT / 'dist'
DEFAULT_FUNCTION_NAME = 'AnaAlexaSkill'
DEFAULT_REGION = os.getenv('AWS_REGION', 'us-west-2')


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=check, text=True)


def npm_build() -> None:
    print('Building project (npm run build)...')
    run(['npm', 'run', 'build'], cwd=ROOT)
    if not DIST_DIR.exists():
        raise RuntimeError('Build succeeded but dist/ not found. Check esbuild output path.')


def create_zip() -> Path:
    print('Creating deployment ZIP from dist/...')
    tmp_dir = Path(tempfile.mkdtemp(prefix='ana-alexa-'))
    try:
        # Copy only dist/ (esbuild bundle includes dependencies)
        bundle_dir = tmp_dir / 'bundle'
        bundle_dir.mkdir(parents=True, exist_ok=True)
        shutil.copytree(DIST_DIR, bundle_dir / 'dist')

        zip_path = ROOT / 'alexa-skill-deployment.zip'
        if zip_path.exists():
            zip_path.unlink()

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for p in (bundle_dir / 'dist').rglob('*'):
                if p.is_file():
                    arcname = str(p.relative_to(bundle_dir))
                    zf.write(p, arcname)
        print(f'Created ZIP: {zip_path}')
        return zip_path
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def get_account_id() -> str:
    try:
        r = subprocess.run(
            ['aws', 'sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'],
            capture_output=True, text=True, check=True
        )
        return (r.stdout or '').strip()
    except subprocess.CalledProcessError as e:
        print('ERROR: Unable to get AWS account ID. Is AWS CLI configured?')
        print(e.stderr)
        sys.exit(1)


def lambda_function_exists(function_name: str, region: str) -> bool:
    try:
        subprocess.run(
            ['aws', 'lambda', 'get-function', '--function-name', function_name, '--region', region],
            check=True, capture_output=True, text=True
        )
        return True
    except subprocess.CalledProcessError:
        return False


def update_code(zip_path: Path, function_name: str, region: str) -> None:
    print(f'Updating Lambda function code: {function_name} ({region})')
    run([
        'aws', 'lambda', 'update-function-code',
        '--function-name', function_name,
        '--zip-file', f'fileb://{zip_path}',
        '--region', region,
        '--publish'
    ])


def wait_until_updated(function_name: str, region: str) -> None:
    """Block until Lambda reports the function is updated."""
    try:
        print('Waiting for function to finish updating...')
        run(['aws', 'lambda', 'wait', 'function-updated', '--function-name', function_name, '--region', region])
    except Exception:
        # Non-fatal: proceed; next updates will error out if not yet ready
        pass


def ensure_env_vars(function_name: str, region: str) -> None:
    """Update a minimal set of environment variables expected by this project.
    You can edit these defaults or rely on existing values on the function.
    """
    # Pull existing env
    existing = {}
    try:
        r = subprocess.run([
            'aws', 'lambda', 'get-function-configuration',
            '--function-name', function_name,
            '--region', region,
            '--query', 'Environment.Variables', '--output', 'json'
        ], capture_output=True, text=True, check=True)
        import json
        existing = json.loads(r.stdout or '{}') or {}
    except subprocess.CalledProcessError:
        existing = {}

    # Load .env to allow local overrides
    load_dotenv()

    # Defaults align with template.yaml
    defaults = {
        'PREFERENCES_TABLE_NAME': os.getenv('PREFERENCES_TABLE_NAME', 'AlexaUserPreferences'),
        'HISTORICAL_API_BASE': os.getenv('HISTORICAL_API_BASE', 'https://2kfsa0b68h.execute-api.us-west-2.amazonaws.com/prod/historical-dishes'),
        'RESTAURANT_API_BASE': os.getenv('RESTAURANT_API_BASE', 'https://4ccoyys838.execute-api.us-west-2.amazonaws.com/prod/restaurants'),
        'RECIPES_API_BASE': os.getenv('RECIPES_API_BASE', 'https://h5dyjlxrog.execute-api.us-west-2.amazonaws.com/prod/recipes'),
        'API_TIMEOUT_MS': os.getenv('API_TIMEOUT_MS', '8000'),
        'API_MAX_RETRIES': os.getenv('API_MAX_RETRIES', '1'),
        'USE_BEDROCK_NLQ': os.getenv('USE_BEDROCK_NLQ', 'false'),
        'BEDROCK_MODEL_ID': os.getenv('BEDROCK_MODEL_ID', 'anthropic.claude-3-haiku-20240307-v1:0'),
    }
    merged = {**defaults, **existing}

    # Write to a temp file for update-function-configuration
    import json, tempfile
    with tempfile.NamedTemporaryFile('w', delete=False) as f:
        json.dump({'Variables': merged}, f)
        env_file = f.name

    print('Updating Lambda environment variables...')
    # Ensure function isn't mid-update
    wait_until_updated(function_name, region)
    try:
        run([
            'aws', 'lambda', 'update-function-configuration',
            '--function-name', function_name,
            '--region', region,
            '--handler', 'dist/app.handler',
            '--runtime', 'nodejs20.x',
            '--timeout', '30',
            '--memory-size', '512',
            '--environment', f'file://{env_file}'
        ])
    except subprocess.CalledProcessError as e:
        # Retry once on ResourceConflictException
        if 'ResourceConflictException' in (e.stderr or ''):
            print('Configuration update conflicted with in-progress update. Waiting and retrying once...')
            wait_until_updated(function_name, region)
            run([
                'aws', 'lambda', 'update-function-configuration',
                '--function-name', function_name,
                '--region', region,
                '--handler', 'dist/app.handler',
                '--runtime', 'nodejs20.x',
                '--timeout', '30',
                '--memory-size', '512',
                '--environment', f'file://{env_file}'
            ])
        else:
            raise


def main() -> int:
    function_name = os.getenv('LAMBDA_FUNCTION_NAME', DEFAULT_FUNCTION_NAME)
    region = os.getenv('AWS_REGION', DEFAULT_REGION)

    print(f'Function: {function_name}\nRegion:   {region}')

    # Build and package
    npm_build()
    zip_path = create_zip()

    # Ensure function exists
    exists = lambda_function_exists(function_name, region)
    if not exists:
        print(f"ERROR: Function '{function_name}' does not exist in region {region}.")
        print('Please create it once (e.g., with deploy-lambda.sh or SAM), then re-run this script.')
        return 2

    # Update code and env
    update_code(zip_path, function_name, region)
    # Wait for function to finish updating code to avoid config conflicts
    wait_until_updated(function_name, region)
    ensure_env_vars(function_name, region)

    # Print function summary
    print('\nDeployment complete. Current function info:')
    run([
        'aws', 'lambda', 'get-function', '--function-name', function_name,
        '--region', region,
        '--query', 'Configuration.[FunctionName,Runtime,Handler,LastModified,MemorySize,Timeout]',
        '--output', 'table'
    ], check=False)

    return 0


if __name__ == '__main__':
    sys.exit(main())
