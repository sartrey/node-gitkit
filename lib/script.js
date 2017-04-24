'use strict'

const fs = require('fs')
const path = require('path')

const assist = require('./assist.js')
const config = require('./config.js')
const simple = require('./simple.js')

module.exports = {
  readyRepo,
  updateRepo,
  findOrigin
}

/**
 * ready repository
 * verify .git, remote
 *
 * @param  {String} cwd
 * @param  {String} repo
 * @return {Promise} ready
 */
function readyRepo(cwd, repo) {
  function resetRepo() {
    return assist.safeExecute(`rm -rf ${cwd} && mkdir -p ${cwd}`)
    .then(function () { return false })
  }

  if (!assist.existsPath(cwd)) {
    return resetRepo()
  }
  var rootFiles = fs.readdirSync(cwd)
  if (rootFiles.indexOf('.git') < 0) {
    if (rootFiles.length > 0) {
      // fix .git not found
      return resetRepo()
    }
  } else {
    var gitFiles = fs.readdirSync(path.join(cwd, '/.git'))
    var configText = fs.readFileSync(path.join(cwd, '/.git/config'), 'utf8')
    if (gitFiles.indexOf('HEAD') >= 0 && configText.indexOf(repo) >= 0) {
      return Promise.resolve(true)
    }
    return resetRepo()
  }
  return Promise.resolve(false)
}

/**
 * update repository to revision
 *
 * @param  {String} cwd
 * @param  {String} rev
 */
function updateRepo(cwd, rev) {
  var sshkey = config.getSSHKey()
  if (!sshkey) {
    return assist.nullSSHKey()
  }

  var execOptsWithSSH = { cwd, sshkey, ignore: true }

  var scriptTryUpdate = [
    `git checkout -qf ${rev} && git pull`,
    `git reset --hard origin/${rev}`,
    'git fetch --tags'
  ].join(' && ')

  var scriptFixBranch = [
    'git branch -D branch_used_to_delete_branch || echo "branch not found"',
    'git checkout -b branch_used_to_delete_branch',
    `git branch -D ${rev}`,
    `git remote update && git fetch origin ${rev}`,
    `git checkout -q -b ${rev} origin/${rev}`,
    `git branch -D branch_used_to_delete_branch`
  ].join(' && ')

  var scriptCleanRepo = 'git remote prune origin && git gc'

  return Promise.resolve()
  .then(() => assist.safeExecute(scriptCleanRepo, execOptsWithSSH))
  .then(() => assist.safeExecute(scriptTryUpdate, execOptsWithSSH))
  .catch(error => {
    console.log(error)
    return assist.safeExecute(scriptFixBranch, execOptsWithSSH)
    .then(function () {
      return assist.safeExecute(scriptTryUpdate, execOptsWithSSH)
    })
  })
}

/**
 * find origin commits with same blobs in rev
 *
 * @param  {String} cwd
 * @param  {String} rev - revision
 * @return {Promise} { file: { blob, zero } }
 */
function findOrigin(cwd, rev) {
  return Promise.all([
    // get ref blob table
    simple.getBlobTable(cwd, rev, '$4,$3').then(function (table) {
      var maps = {}
      for (var i = 0; i < table.length; i += 2) {
        maps[table[i]] = { blob: table[i + 1], zero: null }
      }
      return maps
    }),

    // get all revs about cwd
    simple.getFileTrack(cwd, cwd)
  ])
  .then(function (batch) {
    var maps = batch[0]
    var revs = batch[1]
    // from oldest rev to latest rev
    var steps = revs.reverse().map(function (revI, i) {
      return function () {
        return simple.getBlobTable(cwd, revI, '$4,$3')
        .then(function (table) {
          for (var k = 0; k < table.length; k += 2) {
            let map = maps[table[k]]
            if (map && !map.zero && map.blob === table[k + 1]) {
              map.zero = [revI, i]
            }
          }
        })
      }
    })
    return assist.chainPromise(steps)
    .then(function () {
      return Promise.resolve(maps)
    })
  })
}
