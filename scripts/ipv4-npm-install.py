#!/usr/bin/env python3
"""Install npm packages by fetching packuments/tarballs over IPv4 via curl."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NODE_MODULES = ROOT / "node_modules"
CACHE = ROOT / ".deps-cache"
REGISTRY = "https://registry.npmjs.org"

# Top-level deps from package.json (name -> version range resolved to latest matching later)
TOP_LEVEL = {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "vite": "^6.3.5",
    "@vitejs/plugin-react": "^4.5.2",
}


def curl_json(url: str) -> dict:
    result = subprocess.run(
        ["curl", "-4", "-fsSL", "--max-time", "60", url],
        check=True,
        capture_output=True,
    )
    return json.loads(result.stdout.decode())


def curl_file(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["curl", "-4", "-fsSL", "--max-time", "120", url, "-o", str(dest)],
        check=True,
    )


def parse_range_to_version(packument: dict, range_spec: str) -> str:
    dist_tags = packument.get("dist-tags", {})
    versions = packument.get("versions", {})
    if range_spec in dist_tags:
        return dist_tags[range_spec]
    if range_spec in versions:
        return range_spec

    latest = dist_tags.get("latest")
    if range_spec.startswith("^") and latest:
        major = range_spec[1:].split(".")[0]
        if latest.split(".")[0] == major:
            return latest
        # Pick highest version with same major
        same_major = [v for v in versions if v.split(".")[0] == major and not any(c in v for c in "-+")]
        if same_major:
            return sorted(same_major, key=lambda v: [int(x) for x in v.split(".")])[-1]
    if range_spec.startswith("~") and latest:
        parts = range_spec[1:].split(".")
        prefix = ".".join(parts[:2])
        same_minor = [v for v in versions if v.startswith(prefix + ".") and not any(c in v for c in "-+")]
        if same_minor:
            return sorted(same_minor, key=lambda v: [int(x) for x in v.split(".")])[-1]
    return latest


def package_url_name(name: str) -> str:
    return name.replace("/", "%2F")


def install_package(name: str, range_spec: str, installed: set[str], is_top: bool = False) -> None:
    key = f"{name}@{range_spec}"
    if key in installed and not is_top:
        return

    print(f"fetch {name}@{range_spec}")
    packument = curl_json(f"{REGISTRY}/{package_url_name(name)}")
    version = parse_range_to_version(packument, range_spec)
    meta = packument["versions"][version]
    tarball_url = meta["dist"]["tarball"]

    tgz = CACHE / f"{name.replace('/', '__')}-{version}.tgz"
    if not tgz.exists():
        print(f"  download {tarball_url}")
        curl_file(tarball_url, tgz)

    with tempfile.TemporaryDirectory() as tmp:
        with tarfile.open(tgz, "r:gz") as tar:
            tar.extractall(tmp)
        extracted = Path(tmp) / "package"
        target = NODE_MODULES / name
        if target.exists():
            shutil.rmtree(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(extracted, target)

    installed.add(key)
    installed.add(f"{name}@{version}")

    deps = dict(meta.get("dependencies") or {})
    for peer_name, peer_range in (meta.get("peerDependencies") or {}).items():
        if peer_name in ("react", "react-dom", "vite"):
            deps.setdefault(peer_name, peer_range)

    optional = meta.get("optionalDependencies") or {}
    platform = os_platform_pkg()
    for dep_name, dep_range in optional.items():
        if dep_name.startswith("@esbuild/") or dep_name.startswith("@rollup/rollup-"):
            if platform.replace("-", "") in dep_name.replace("-", "") or platform in dep_name:
                deps[dep_name] = dep_range
            elif dep_name.endswith(platform) or dep_name.endswith(f"{platform}-gnu") or dep_name.endswith(f"{platform}-musl"):
                deps[dep_name] = dep_range
        else:
            deps.setdefault(dep_name, dep_range)

    for dep_name, dep_range in deps.items():
        if dep_name.startswith("@esbuild/") and not dep_name.endswith(platform) and f"-{platform}" not in dep_name:
            continue
        if dep_name.startswith("@rollup/rollup-") and platform not in dep_name:
            continue
        try:
            install_package(dep_name, dep_range, installed, is_top=False)
        except Exception as exc:  # noqa: BLE001
            print(f"  skip {dep_name}: {exc}", file=sys.stderr)


def os_platform_pkg() -> str:
    import platform

    system = platform.system().lower()
    machine = platform.machine().lower()
    if system == "linux":
        arch = "arm64" if machine in ("aarch64", "arm64") else "x64"
        return f"linux-{arch}"
    if system == "darwin":
        arch = "arm64" if machine in ("aarch64", "arm64") else "x64"
        return f"darwin-{arch}"
    return f"{system}-{machine}"


def main() -> int:
    NODE_MODULES.mkdir(exist_ok=True)
    CACHE.mkdir(exist_ok=True)
    installed: set[str] = set()

    # Ensure platform binary packages for esbuild/rollup are pulled
    for name, range_spec in TOP_LEVEL.items():
        install_package(name, range_spec, installed, is_top=True)

    # Explicit platform optional deps commonly needed
    try:
        install_package(f"@esbuild/{os_platform_pkg()}", "*", installed)
    except Exception as exc:  # noqa: BLE001
        print(f"warning: platform esbuild package: {exc}", file=sys.stderr)

    # Symlink .bin entries from package.json bin fields
    bin_dir = NODE_MODULES / ".bin"
    bin_dir.mkdir(exist_ok=True)
    for pkg_json in NODE_MODULES.rglob("package.json"):
        # only direct children packages depth control: node_modules/name or node_modules/@scope/name
        rel = pkg_json.relative_to(NODE_MODULES)
        parts = rel.parts
        if len(parts) not in (2, 3):
            continue
        if parts[0].startswith("."):
            continue
        data = json.loads(pkg_json.read_text())
        bins = data.get("bin")
        if not bins:
            continue
        if isinstance(bins, str):
            bins = {data["name"].split("/")[-1]: bins}
        for bin_name, bin_rel in bins.items():
            src = (pkg_json.parent / bin_rel).resolve()
            dest = bin_dir / bin_name
            if dest.exists() or dest.is_symlink():
                dest.unlink()
            dest.symlink_to(src)
            os.chmod(src, 0o755)

    # Write a minimal package-lock marker so users know install happened via bootstrap
    (ROOT / "package-lock.json").write_text(
        json.dumps({"name": "trello", "lockfileVersion": 3, "requires": True, "packages": {}}, indent=2)
        + "\n"
    )
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
