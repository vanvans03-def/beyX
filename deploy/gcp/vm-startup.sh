#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# This startup script contains no credentials. Keep temporary public egress until
# it has completed; private Google access alone cannot reach Ubuntu repositories.
apt-get update
apt-get install -y docker.io docker-compose-v2 ca-certificates curl
systemctl enable --now docker
install -d -m 0700 /opt/beyx /opt/beyx/backups

if ! swapon --show=NAME --noheadings | grep -Fxq /swapfile-beyx; then
    if [ ! -e /swapfile-beyx ]; then
        fallocate -l 2G /swapfile-beyx
        chmod 0600 /swapfile-beyx
        mkswap /swapfile-beyx
    fi
    swapon /swapfile-beyx
fi
if ! grep -q '^/swapfile-beyx ' /etc/fstab; then
    printf '/swapfile-beyx none swap sw 0 0\n' >> /etc/fstab
fi
printf 'vm.swappiness=10\n' > /etc/sysctl.d/90-beyx.conf
sysctl -p /etc/sysctl.d/90-beyx.conf
touch /opt/beyx/bootstrap-ready
