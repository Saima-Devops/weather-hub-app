"""Copy browser assets to Vercel's CDN directory; keep Flask local paths unchanged."""
from pathlib import Path
from shutil import copytree

ROOT = Path(__file__).resolve().parent.parent


def build():
    source = ROOT / "static"
    destination = ROOT / "public" / "static"
    copytree(source, destination, dirs_exist_ok=True)
    print("Prepared browser assets in public/static for Vercel.")


if __name__ == "__main__":
    build()
