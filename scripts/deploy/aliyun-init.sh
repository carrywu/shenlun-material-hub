#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/shenlun-material-hub}"

log() {
  printf '[aliyun-init] %s\n' "$*"
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    printf 'Run this script as root.\n' >&2
    exit 1
  fi
}

install_debian() {
  log "Configuring apt mirror for China mainland"
  . /etc/os-release
  local codename="${VERSION_CODENAME:-jammy}"
  cp /etc/apt/sources.list "/etc/apt/sources.list.bak.$(date +%Y%m%d%H%M%S)" || true
  cat >/etc/apt/sources.list <<EOF
deb http://mirrors.aliyun.com/ubuntu/ ${codename} main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ ${codename}-updates main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ ${codename}-backports main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ ${codename}-security main restricted universe multiverse
EOF

  apt-get update
  apt-get install -y ca-certificates curl gnupg git openssl

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu ${codename} stable" >/etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_rhel() {
  log "Detected RHEL/CentOS/Alibaba Cloud Linux family"
  yum install -y yum-utils git ca-certificates curl openssl
  yum-config-manager --add-repo http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
  yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

configure_docker() {
  mkdir -p /etc/docker
  cat >/etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://registry.cn-hangzhou.aliyuncs.com",
    "https://docker.m.daocloud.io",
    "https://mirror.ccs.tencentyun.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
EOF
  systemctl enable --now docker
  systemctl restart docker
}

main() {
  require_root
  if [ -f /etc/debian_version ]; then
    install_debian
  elif [ -f /etc/redhat-release ] || [ -f /etc/alinux-release ]; then
    install_rhel
  else
    printf 'Unsupported Linux distribution. Install Docker and Docker Compose plugin manually.\n' >&2
    exit 1
  fi

  configure_docker
  mkdir -p "$APP_DIR" "$APP_DIR/backups" "$APP_DIR/data/uploads"

  log "Docker version: $(docker --version)"
  log "Compose version: $(docker compose version)"
  log "Deployment directory: $APP_DIR"
  log "Security group reminder: open 80/443, restrict 22 to your IP, keep 3000/5432 closed."
}

main "$@"
