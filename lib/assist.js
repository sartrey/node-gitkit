'use strict'

const child_process = require('child_process')
const fs = require('fs')
const path = require('path')

module.exports = {
  nullSSHKey,
  existsPath,
  safeExecute,
  chainPromise
}

/**
 * reject null sshkey
 *
 * @return {Promise}
 */
function nullSSHKey() {
  return Promise.reject('sshkey not set')
}

/**
 * test if path exists
 *
 * @param  {String} p
 * @return {Boolean}
 */
function existsPath(p) {
  try {
    fs.accessSync(p, fs.F_OK)
    return true
  } catch (error) {
    return false
  }
}

/**
 * promise to execute command
 * stderr can be ignored, useful for git
 * options:
 *  {Boolean} ignore - skip stderr
 *  {Boolean} sshkey - sshkey file
 *
 * @param  {String} command
 * @param  {Object=} args
 * @param  {Object=} options
 * @return {Promise}
 */
function safeExecute(command, args, options = {}) {
  return new Promise(function (resolve, reject) {
    /**
     * exec callback
     *
     * @param  {Object} error
     * @param  {Buffer} stdout
     * @param  {Buffer} stderr
     */
    function execCb (error, stdout, stderr) {
      // reject if error
      if (error) return reject(error)
      
      // resolve if ignore stderr
      if (options && options.ignore) return resolve(stdout)
      
      // resolve if null or empty stderr(Buffer)
      if (!stderr || stderr.length === 0) return resolve(stdout)
      
      // reject if stderr
      reject(new Error(stderr.toString()))
    }
    
    if (options) {
      if (options.cwd && !existsPath(options.cwd)) {
        return reject(new Error('cwd not found'))
      }
      
      if (options.sshkey) {
        command = `ssh-agent bash -c 'ssh-add ${options.sshkey}; ${command}'`
      }
    }
    // console.log(command)
    child_process.execFile(command, args, options, execCb)
  })
}

/**
 * chain promise
 *
 * @param  {Promise[]} promises
 * @return {Promise} chain
 */
function chainPromise(promises) {
  var chain = Promise.resolve()
  promises.forEach(function (promise) {
    chain = chain.then(function (o) {
      return typeof promise === 'function' ? promise(o) : promise
    })
  })
  return chain
}
