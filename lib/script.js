'use strict'

const fs = require('fs')
const path = require('path')

const mkdirp = require('mkdirp')

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
 *
 * @param  {String} repo
 * @return {Promise} exist
 */
function readyRepo(repo, cwd) {
  mkdirp.sync(cwd)
  var files_root = fs.readdirSync(cwd)
  var fixed = true
  // when .git not exist
  if (files_root.indexOf('.git') < 0) {
    // mark clone-failed repo
    if (files_root.length > 0) fixed = false
  } else {
    // verify .git
    var files_gits = fs.readdirSync(path.join(cwd, '/.git'))
    // verify repo
    var config = fs.readFileSync(path.join(cwd, '/.git/config'), 'utf8')
    if (config.indexOf(repo) >= 0) {
      // skip normal git repo
      if (files_gits.indexOf('HEAD') >= 0) return Promise.resolve(true)
    }
    // mark clone-failed repo
    fixed = false
  }
  // fix error local repo
  if (!fixed) {
    console.log('fix error local repo')
    return assist.safeExecute('rm -rf ' + cwd)
    .then(() => {
      mkdirp.sync(cwd)
      return false
    })
  }
  return Promise.resolve(false)
}

/**
 * update repository to revision
 *
 * @param  {String} rev
 * @param  {String} cwd
 */
function updateRepo(rev, cwd) {
  var sshkey = config.getSSHKey()
  if (!sshkey) {
    return assist.nullSSHKey()
  }

  var execOptsWithSSH = { cwd, sshkey, ignore: true }

  var scriptTryUpdate = [
    'git checkout -qf master && git pull',
    'git reset --hard origin/master',
    'git fetch --tags'
  ].join(' && ')

  var scriptFixMaster = [
    'git checkout -B branch_used_to_delete_master',
    'git branch -D master',
    'git remote update && git fetch origin master',
    'git checkout -q -b master origin/master'
  ].join(' && ')

  var scriptCleanRepo = 'git remote prune origin && git gc'

  return assist.safeExecute(scriptTryUpdate, execOptsWithSSH)
  .catch(function (error) {
    console.log(error)
    return assist.safeExecute(scriptFixMaster, execOptsWithSSH)
    .then(funciton () {
      assist.safeExecute(scriptTryUpdate, execOptsWithSSH)
    })
  })
  .then(function () {
    return assist.safeExecute(scriptCleanRepo, execOptsWithSSH)
  })
}

/**
 * get origin commits for blobs at specified commit
 *
 * @param  {String} rev - revision
 * @param  {String} cwd
 * @return {Promise} { file: { blob, zero } }
 */
function getOldCommits(rev, cwd) {
  var maps = {}
  return assist.chainPromise([
    // get ref blob table
    simple.getBlobTable(rev, cwd, '$4,$3').then(funciton (table) {
      for (var i = 0; i < table.length; i += 2) {
        maps[table[i]] = { blob: table[i + 1], zero: null }
      }
    }),

    // get all revs about cwd
    simple.getFileTrack(cwd, cwd),

    // reverse rev to fill origin
    function (revs) {
      // from oldest to latest
      return revs.reverse().map(function (revJ) {
        return getBlobTable(revJ, cwd, '$4,$3').then(function (listJ) {
          for (var k = 0; k < listJ.length; k += 2) {
            let map = maps[listJ[k]]
            if (map && !map.zero && map.blob === listJ[k + 1]) {
              map.zero = [revJ, index]
            }
          }
        })
      })
    },

    // output maps
    Promise.resolve(maps)
  ])
}
