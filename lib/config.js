'use strict'

const CACHE = {}

module.exports = {
  getSSHKey,
  setSSHKey
}

function getSSHKey() {
  return CACHE.sshkey
}

function setSSHKey(value) {
  CACHE.sshkey = value
}
