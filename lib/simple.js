'use strict'

const fs = require('fs')
const path = require('path')

const assist = require('./assist.js')
const config = require('./config.js')

/**
 * trim string
 *
 * @param  {String} text
 * @return {String}
 */
function trimString(text) {
  return text.trim()
}

module.exports = {
  getGitVer,
  cloneRepo,
  makeCommit,
  pushChange,
  hashObject,
  getHashType,
  getLocalHash,
  getRemoteHash,
  getBlobTable,
  getDiffTable,
  getFileTrack,
  getMergeBase,
  getBlobContent
}

/**
 * get git version
 *
 * @return {String}
 */
function getGitVer() {
  return assist.safeExecute('git version', { ignore: true })
}

/**
 * clone repository
 *
 * @param  {String} cwd
 * @param  {String} repo
 * @return {Promise}
 */
function cloneRepo(cwd, repo) {
  var sshkey = config.getSSHKey()
  if (!sshkey) {
    return assist.nullSSHKey()
  }
  return assist.safeExecute(
    `git clone -q ${repo} ./`,
    { cwd, sshkey, ignore: true }
  )
}

/**
 * add all files and make commit
 *
 * @param  {String} cwd
 * @param  {String} msg
 * @return {Promise}
 */
function makeCommit(cwd, msg) {
  return assist.safeExecute(
    `git add . && git commit -m "${msg}"`,
    { cwd, ignore: true }
  )
}

/**
 * push commits to remote
 *
 * @param  {String} cwd
 * @return {Promise}
 */
function pushChange(cwd) {
  var sshkey = config.getSSHKey()
  if (!sshkey) {
    return assist.nullSSHKey()
  }
  return assist.safeExecute(
    `git push`, { cwd, sshkey, ignore: true }
  )
}

/**
 * write object & get hash
 *
 * @param  {String} cwd
 * @param  {String} file
 * @return {Promise}
 */
function hashObject(cwd, file) {
  return assist.safeExecute(
    `git hash-object -w ${file}`,
    { cwd, ignore: true }
  )
  .then(stdout => stdout.match(/\S+/g))
  .catch(Function.prototype)
}

/**
 * get hash type
 *
 * @param  {String} cwd
 * @param  {String} hash
 * @return {Promise}
 */
function getHashType(cwd, hash) {
  return assist.safeExecute(
    'git cat-file -t ' + hash,
    { cwd, ignore: true }
  )
  .then(trimString)
  .catch(function () { return 'unknown' })
}

/**
 * parse local revision
 * 1 - tag => 2 - branch
 *
 * @param  {String} cwd
 * @param  {String} rev
 * @return {Promise}
 */
function getLocalHash(cwd, rev) {
  return assist.safeExecute(
    `git rev-parse --verify ${rev}`,
    { cwd, ignore: true })
  .then(trimString)
  .catch(function () {
    return assist.safeExecute(
      `git rev-parse --verify origin/${rev}`,
      { cwd, ignore: true }
    )
    .then(trimString)
  })
}

/**
 * parse remote revision
 *
 * @param  {String} cwd
 * @param  {String} rev
 * @return {Promise}
 */
function getRemoteHash(cwd, rev) {
  return assist.safeExecute(
    `git ls-remote origin ${rev}`,
    { cwd, ssh: true, ignore: true }
  )
  .then(stdout => stdout.match(/\S+/g)[0])
  .catch(Function.prototype)
}

/**
 * get blob table
 * ls-tree [mode, type, hash, file]
 *
 * @param  {String} cwd
 * @param  {String} rev - revision
 * @param  {String} map - awk print
 * @return {Promise}
 */
function getBlobTable(cwd, rev, map) {
  if (!rev) return Promise.resolve([])
  var awk = map ? `| awk '{print ${map}}'` : ''
  return assist.safeExecute(
    `git ls-tree -r ${rev} ${awk}`,
    { cwd, ignore: true, maxBuffer: 1024 * 1024 * 20 }
  )
  .then(stdout => stdout.match(/\S+/g) || [])
  .catch(error => {
    console.log(error.message)
    return []
  })
}

/**
 * get diff table
 *
 * @param  {String} cwd
 * @param  {String} rev - revision
 * @param  {String} map - awk print
 * @return {Promise}
 */
function getDiffTable(cwd, rev, map) {
  var awk = map ? ` | awk '{print ${map}}'` : ''

  return assist.safeExecute(
    `git diff-tree -r ${rev}${awk}`,
    { cwd, ignore: true })
  .then(stdout => stdout.match(/\S+/g) || [])
}

/**
 * get file track
 *
 * @param  {String} cwd
 * @param  {String} file
 * @return {Promise}
 */
function getFileTrack(cwd, file) {
  return assist.safeExecute(
    'git rev-list --abbrev-commit --all ' + (file || ''),
    { cwd, ignore: true }
  )
  .then(stdout => stdout.match(/\S+/g) || [])
}

/**
 * get merge base
 *
 * @param  {String} cwd
 * @param  {String} rev1
 * @param  {String} rev2
 * @return {Promise}
 */
function getMergeBase(cwd, rev1, rev2) {
  return assist.safeExecute(
    `git merge-base ${rev1} ${rev2}`,
    { cwd, ignore: true }
  )
  .catch(Function.prototype)
}

/**
 * get blob content
 *
 * @param  {String} cwd
 * @param  {String} hash
 * @param  {String} enc
 * @return {Promise}
 */
function getBlobContent(cwd, hash, enc) {
  return assist.safeExecute(
    `git cat-file -p ${hash}`,
    { cwd, encoding: enc, maxBuffer: 1024 * 1024 * 20 }
  )
  .catch(error => {
    console.log(error)
    throw new Error('file is too large')
  })
}
