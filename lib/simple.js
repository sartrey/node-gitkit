'use strict'

const fs = require('fs')
const path = require('path')

const assist = require('./assist.js')
const config = require('./config.js')

module.exports = {
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
 * clone repository
 *
 * @param  {String} repo
 * @param  {String} cwd
 * @return {Promise}
 */
function cloneRepo(repo, cwd) {
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
 * @param  {String} msg
 * @param  {String} cwd
 * @return {Promise}
 */
function makeCommit(msg, cwd) {
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
 * @param  {String} file
 * @param  {String} cwd
 * @return {Promise}
 */
function hashObject(file, cwd) {
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
 * @param  {String} hash
 * @param  {String} cwd
 * @return {Promise}
 */
function getHashType(hash, cwd) {
  return assist.safeExecute(
    'git cat-file -t ' + hash,
    { cwd, ignore: true }
  )
  .then(stdout => stdout.trim())
  .catch(error => 'unknown')
}

/**
 * parse local revision
 * 1 - tag => 2 - branch
 *
 * @param  {String} rev
 * @param  {String} cwd
 * @return {Promise}
 */
function getLocalHash(rev, cwd) {
  return assist.safeExecute(
    `git rev-parse --verify ${rev}`,
    { cwd, ignore: true })
  .then(stdout => stdout.trim())
}

/**
 * parse remote revision
 *
 * @param  {String} rev
 * @param  {String} cwd
 * @return {Promise}
 */
function getRemoteHash(rev, cwd) {
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
 * @param  {String} rev - revision
 * @param  {String} cwd
 * @param  {String} map - awk print
 * @return {Promise}
 */
function getBlobTable(rev, cwd, map) {
  if (!rev) return []
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
 * @param  {String} rev - revision
 * @param  {String} cwd
 * @param  {String} map - awk print
 * @return {Promise}
 */
function getDiffTable(rev, cwd, map) {
  var awk = map ? ` | awk '{print ${map}}'` : ''

  return assist.safeExecute(
    `git diff-tree -r ${rev}${awk}`,
    { cwd, ignore: true })
  .then(stdout => stdout.match(/\S+/g) || [])
}

/**
 * get file track
 *
 * @param  {String} file
 * @param  {String} cwd
 * @return {Promise}
 */
function getFileTrack(file, cwd) {
  return assist.safeExecute(
    'git rev-list --abbrev-commit --all ' + (file || ''),
    { cwd, ignore: true }
  )
  .then(stdout => stdout.match(/\S+/g) || [])
}

/**
 * get merge base
 *
 * @param  {String} hash1
 * @param  {String} hash2
 * @param  {String} cwd
 * @return {Promise}
 */
function getMergeBase(hash1, hash2, cwd) {
  return assist.safeExecute(
    `git merge-base ${hash1} ${hash2}`,
    { cwd, ignore: true }
  )
  .catch(Function.prototype)
}

/**
 * get blob content
 *
 * @param  {String} hash
 * @param  {String} cwd
 * @param  {String} enc
 * @return {Promise}
 */
function getBlobContent(hash, cwd, enc) {
  return assist.safeExecute(
    `git cat-file -p ${hash}`,
    { cwd, encoding: enc, maxBuffer: 1024 * 1024 * 20 }
  )
  .catch(error => {
    console.log(error)
    throw new Error('file is too large')
  })
}
