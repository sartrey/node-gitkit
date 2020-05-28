'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const assist = require('../lib/assist.js')
const gitkit = require('../index.js')

const TEST_WORK = path.join(__dirname, 'workdir')
const TEST_REPO = 'git@github.com:sartrey/github-test.git'
const TEST_SSHK = path.join(__dirname, 'github-deploy')

Promise.prototype.shouldFail = function () {
  const FAIL = () => Promise.reject()
  const PASS = () => Promise.resolve()
  return this.then(FAIL, PASS)
}

describe('reset test env', function () {
  it('show git version', function () {
    return gitkit.getGitVer().then(console.log)
  })
  
  it('reset fixture', function () {
    return assist.chainPromise([
      assist.safeExecute('rm', ['-rf', TEST_WORK]),
      assist.safeExecute('mkdir', ['-p', TEST_WORK]),
    ])
  })
  
  it('fix ssh key acl', function () {
    return assist.safeExecute('chmod', ['400', TEST_SSHK])
  })
})

describe('assist', function () {
  it('null ssh key', function () {
    return gitkit.cloneRepo(TEST_WORK, TEST_REPO)
      .shouldFail()
  })
  
  it('null cwd', function () {
    return assist.safeExecute('cat', ['abc'], { cwd: path.join(__dirname, 'never') })
      .shouldFail()
  })
  
  it('error command', function () {
    return assist.safeExecute('what-is-this-command', {}, { cwd: TEST_WORK })
      .shouldFail()
  })
})

describe('simple: remote', function () {
  this.timeout(25000)
  
  it('set ssh key', function () {
    gitkit.setSSHKey(TEST_SSHK)
  })
  
  it('clone repository', function () {
    return gitkit.cloneRepo(TEST_WORK, TEST_REPO)
  })
  
  it('get remote hash: tag, HEAD, unknown', function () {
    // skip remote hash test
    return Promise.resolve()
    // real test for newer git
    return Promise.all([
        gitkit.getRemoteHash(TEST_WORK, 'new-a'),
        gitkit.getRemoteHash(TEST_WORK, 'HEAD'),
        gitkit.getRemoteHash(TEST_WORK, 'aaabbbccc')
      ])
      .then(vs => assert.deepEqual(vs, [
        '1160fdddf436b79bfe092add69d6c3bbca34ce4e',
        '602061db167b5ea0631398f513cfaa3d64ba308e',
        undefined
      ]))
  })
})

describe('simple: local', function () {
  it('get local hash: branch', function () {
    return gitkit.getLocalHash(TEST_WORK, 'gitkit-test')
      .then(v => assert.equal(v, '1160fdddf436b79bfe092add69d6c3bbca34ce4e'))
  })
  
  it('get local hash: tag', function () {
    return gitkit.getLocalHash(TEST_WORK, 'new-a')
      .then(v => assert.equal(v, '1160fdddf436b79bfe092add69d6c3bbca34ce4e'))
  })
  
  it('get local hash: HEAD', function () {
    return gitkit.getLocalHash(TEST_WORK, 'HEAD')
      .then(v => assert.equal(v, '515141464989b77a4cc12d4f51bf096308633d94'))
  })
  
  it('get blob table, i4 + i3', function () {
    return gitkit.getBlobTable(TEST_WORK, '1160fdddf436b79bfe', '$4,$3')
      .then(v => assert.equal(v.length, 4))
  })
  
  it('get hash type: commit, short', function () {
    return gitkit.getHashType(TEST_WORK, '1160fdddf436b79bfe')
      .then(v => assert.equal(v, 'commit'))
  })
  
  it('get hash type: blob, short', function () {
    return gitkit.getHashType(TEST_WORK, 'b54b2e555c82b31c4b')
      .then(v => assert.equal(v, 'blob'))
  })
  
  it('get hash type: unknown', function () {
    return gitkit.getHashType(TEST_WORK, 'abcdefabcdefabcdef')
      .then(v => assert.equal(v, 'unknown'))
  })
  
  it('get blob content', function () {
    // todo: test binary
    return gitkit.getBlobContent(TEST_WORK, 'b54b2e555c82b31c4b', 'utf8')
      .then(v => assert.equal(v.trim(), '# github-test'))
  })
  
  it('reset repository', function () {
    return gitkit.resetRepo(TEST_WORK, 'HEAD~1')
  })
  
  it('make commit', function () {
    fs.writeFileSync(path.join(TEST_WORK, 'test'), '')
    return gitkit.makeCommit(TEST_WORK, 'new commit', {
      email: 'sartrey@163.com', name: 'sartrey'
    })
  })
})

describe('script', function () {
  this.timeout(50000)
  
  it('ready repository', function () {
    return gitkit.readyRepo(TEST_WORK, TEST_REPO)
  })
  
  it('update repository', function () {
    return gitkit.updateRepo(TEST_WORK, 'master')
  })
  
  it('find repo origin', function () {
    return gitkit.findOrigin(TEST_WORK, 'HEAD')
      .then(v => {
        assert.deepEqual(v, {
          'README.md': {
            blob: 'b54b2e555c82b31c4bd7436f525fa3fdbdc98fef',
            zero: [ '602061d', 0 ]
          },
          'abc': {
            blob: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            zero: [ '5151414', 2 ]
          }
        })
      })
  })
})
