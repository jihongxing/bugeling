// pages/verify/qrcode/qrcode.js - 核销码展示
var location = require('../../../utils/location')

Page({
  data: {
    activityId: '',
    activityTitle: '',
    qrToken: '',
    expireAt: 0,
    countdown: 60,
    arrived: false,
    loading: true,
    error: ''
  },
  _countdownTimer: null,

  onLoad: function (options) {
    if (options.activityId) {
      this.setData({
        activityId: options.activityId,
        activityTitle: options.title || ''
      })
      // 预取位置（静默，不阻塞页面）
      location.prefetchLocation()
      this.refreshQrCode()
    }
  },

  onUnload: function () {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  },

  refreshQrCode: function () {
    var self = this
    self.setData({ loading: true, error: '' })
    wx.cloud.callFunction({
      name: 'generateQrToken',
      data: { activityId: self.data.activityId }
    }).then(function (res) {
      if (res.result && res.result.code === 0) {
        var data = res.result.data
        self.setData({ qrToken: data.qrToken, expireAt: data.expireAt, loading: false, countdown: 60 })
        self.drawQrCode(data.qrToken)
        self.startCountdown()
      } else {
        self.setData({ loading: false, error: (res.result && res.result.message) || '获取核销码失败' })
      }
    }).catch(function () {
      self.setData({ loading: false, error: '网络错误，请重试' })
    })
  },

  drawQrCode: function (text) {
    var self = this
    var query = wx.createSelectorQuery()
    query.select('#qrCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) return
        var canvas = res[0].node
        var ctx = canvas.getContext('2d')
        var dpr = wx.getSystemInfoSync().pixelRatio
        var width = res[0].width
        var height = res[0].height
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
        self._canvas = canvas
        self._ctx = ctx

        // 生成 QR 矩阵并绘制
        var modules = generateQrMatrix(text)
        var size = modules.length
        var cellSize = Math.floor(Math.min(width, height) / (size + 2))
        var offset = Math.floor((width - cellSize * size) / 2)

        // 白色背景
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)

        // 绘制模块
        ctx.fillStyle = '#000000'
        for (var row = 0; row < size; row++) {
          for (var col = 0; col < size; col++) {
            if (modules[row][col]) {
              ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize)
            }
          }
        }
      })
  },

  startCountdown: function () {
    var self = this
    if (self._countdownTimer) clearInterval(self._countdownTimer)
    self._countdownTimer = setInterval(function () {
      var countdown = self.data.countdown - 1
      if (countdown <= 10) {
        self.refreshQrCode()
        return
      }
      self.setData({ countdown: countdown })
    }, 1000)
  },

  handleArrival: function () {
    if (this.data.arrived) return
    var self = this
    location.getCurrentLocation().then(function (loc) {
      return wx.cloud.callFunction({
        name: 'reportArrival',
        data: {
          activityId: self.data.activityId,
          latitude: loc.latitude,
          longitude: loc.longitude
        }
      })
    }).then(function () {
      self.setData({ arrived: true })
      wx.showToast({ title: '已报告到达', icon: 'success' })
    }).catch(function () {
      wx.showToast({ title: '获取位置失败，请授权', icon: 'none' })
    })
  },

  goReport: function () {
    wx.navigateTo({ url: '/pages/report/report?activityId=' + this.data.activityId })
  }
})

// ========== QR Code 生成算法（标准 QR Code Model 2, Version 3, ECC L） ==========

/**
 * 生成 QR 码布尔矩阵
 * @param {string} text - 编码内容
 * @returns {boolean[][]} 二维布尔矩阵，true = 黑色模块
 */
function generateQrMatrix(text) {
  // 使用 Version 自适应：根据内容长度选择版本
  var version = getMinVersion(text)
  var size = version * 4 + 17
  var matrix = createMatrix(size)
  var reserved = createMatrix(size)

  // 1. 放置功能图案
  placeFinders(matrix, reserved, size)
  placeAlignments(matrix, reserved, version, size)
  placeTimingPatterns(matrix, reserved, size)
  placeDarkModule(matrix, reserved, version)
  reserveFormatArea(reserved, size)

  // 2. 编码数据
  var dataCodewords = encodeData(text, version)
  var ecCodewords = generateEC(dataCodewords, version)
  var allCodewords = dataCodewords.concat(ecCodewords)
  var bits = codewordsToBits(allCodewords)

  // 3. 放置数据位
  placeDataBits(matrix, reserved, bits, size)

  // 4. 应用掩码（固定使用掩码 0 简化实现）
  applyMask(matrix, reserved, size, 0)

  // 5. 写入格式信息
  placeFormatInfo(matrix, size, 0)

  return matrix
}

function getMinVersion(text) {
  // Version 容量表（ECC Level L, Byte 模式）
  var caps = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271]
  var len = getByteLength(text)
  for (var v = 1; v <= 10; v++) {
    if (len <= caps[v]) return v
  }
  return 10 // 最大支持 Version 10
}

function getByteLength(str) {
  var len = 0
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i)
    if (code <= 0x7F) len += 1
    else if (code <= 0x7FF) len += 2
    else len += 3
  }
  return len
}

function createMatrix(size) {
  var m = []
  for (var i = 0; i < size; i++) {
    m[i] = []
    for (var j = 0; j < size; j++) {
      m[i][j] = false
    }
  }
  return m
}

function placeFinders(matrix, reserved, size) {
  var positions = [[0, 0], [0, size - 7], [size - 7, 0]]
  for (var p = 0; p < positions.length; p++) {
    var r = positions[p][0], c = positions[p][1]
    for (var dr = 0; dr < 7; dr++) {
      for (var dc = 0; dc < 7; dc++) {
        var isBlack = (dr === 0 || dr === 6 || dc === 0 || dc === 6) ||
          (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)
        if (r + dr < size && c + dc < size) {
          matrix[r + dr][c + dc] = isBlack
          reserved[r + dr][c + dc] = true
        }
      }
    }
    // 分隔符
    for (var i = -1; i <= 7; i++) {
      setReserved(reserved, r - 1, c + i, size)
      setReserved(reserved, r + 7, c + i, size)
      setReserved(reserved, r + i, c - 1, size)
      setReserved(reserved, r + i, c + 7, size)
    }
  }
}

function setReserved(reserved, r, c, size) {
  if (r >= 0 && r < size && c >= 0 && c < size) reserved[r][c] = true
}

function placeAlignments(matrix, reserved, version, size) {
  if (version < 2) return
  var positions = getAlignmentPositions(version)
  for (var i = 0; i < positions.length; i++) {
    for (var j = 0; j < positions.length; j++) {
      var r = positions[i], c = positions[j]
      if (reserved[r][c]) continue
      for (var dr = -2; dr <= 2; dr++) {
        for (var dc = -2; dc <= 2; dc++) {
          var isBlack = (Math.abs(dr) === 2 || Math.abs(dc) === 2) || (dr === 0 && dc === 0)
          matrix[r + dr][c + dc] = isBlack
          reserved[r + dr][c + dc] = true
        }
      }
    }
  }
}

function getAlignmentPositions(version) {
  if (version === 1) return []
  var table = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]
  return table[version - 1] || []
}

function placeTimingPatterns(matrix, reserved, size) {
  for (var i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) {
      matrix[6][i] = (i % 2 === 0)
      reserved[6][i] = true
    }
    if (!reserved[i][6]) {
      matrix[i][6] = (i % 2 === 0)
      reserved[i][6] = true
    }
  }
}

function placeDarkModule(matrix, reserved, version) {
  var r = 4 * version + 9
  matrix[r][8] = true
  reserved[r][8] = true
}

function reserveFormatArea(reserved, size) {
  for (var i = 0; i < 8; i++) {
    reserved[8][i] = true
    reserved[8][size - 1 - i] = true
    reserved[i][8] = true
    reserved[size - 1 - i][8] = true
  }
  reserved[8][8] = true
}

function encodeData(text, version) {
  var bits = []
  // Mode indicator: Byte = 0100
  bits.push(0, 1, 0, 0)
  // Character count (8 bits for V1-9, 16 bits for V10+)
  var bytes = textToBytes(text)
  var countBits = version <= 9 ? 8 : 16
  for (var i = countBits - 1; i >= 0; i--) {
    bits.push((bytes.length >> i) & 1)
  }
  // Data
  for (var b = 0; b < bytes.length; b++) {
    for (var j = 7; j >= 0; j--) {
      bits.push((bytes[b] >> j) & 1)
    }
  }
  // Terminator
  bits.push(0, 0, 0, 0)
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0)
  // Pad codewords
  var totalDataCodewords = getDataCodewords(version)
  var padBytes = [0xEC, 0x11]
  var padIdx = 0
  while (bits.length < totalDataCodewords * 8) {
    for (var k = 7; k >= 0; k--) {
      bits.push((padBytes[padIdx] >> k) & 1)
    }
    padIdx = (padIdx + 1) % 2
  }
  // Convert to codewords
  var codewords = []
  for (var c = 0; c < bits.length; c += 8) {
    var val = 0
    for (var d = 0; d < 8; d++) val = (val << 1) | (bits[c + d] || 0)
    codewords.push(val)
  }
  return codewords.slice(0, totalDataCodewords)
}

function textToBytes(text) {
  var bytes = []
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i)
    if (code <= 0x7F) {
      bytes.push(code)
    } else if (code <= 0x7FF) {
      bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F))
    } else {
      bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F))
    }
  }
  return bytes
}

function getDataCodewords(version) {
  // ECC Level L data codewords per version
  var table = [0, 19, 34, 55, 80, 108, 136, 156, 194, 232, 274]
  return table[version] || 274
}

function getECCodewords(version) {
  var table = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18]
  return table[version] || 18
}

function generateEC(dataCodewords, version) {
  var ecCount = getECCodewords(version)
  var generator = getGeneratorPoly(ecCount)
  var msg = dataCodewords.slice()
  for (var i = 0; i < ecCount; i++) msg.push(0)
  for (var i = 0; i < dataCodewords.length; i++) {
    var coef = msg[i]
    if (coef !== 0) {
      var logCoef = GF_LOG[coef]
      for (var j = 0; j < generator.length; j++) {
        msg[i + j] ^= GF_EXP[(logCoef + generator[j]) % 255]
      }
    }
  }
  return msg.slice(dataCodewords.length)
}

// GF(256) 查找表
var GF_EXP = new Array(256)
var GF_LOG = new Array(256)
;(function () {
  var x = 1
  for (var i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x = x << 1
    if (x >= 256) x ^= 0x11D
  }
  GF_EXP[255] = GF_EXP[0]
})()

function getGeneratorPoly(degree) {
  var poly = [0] // log representation
  for (var i = 0; i < degree; i++) {
    var newPoly = new Array(poly.length + 1)
    for (var j = 0; j < newPoly.length; j++) newPoly[j] = 255 // identity
    for (var j = 0; j < poly.length; j++) {
      newPoly[j] = poly[j]
      var sum = (poly[j] + i) % 255
      if (j + 1 < newPoly.length) {
        if (newPoly[j + 1] === 255) {
          newPoly[j + 1] = sum
        } else {
          newPoly[j + 1] = GF_LOG[GF_EXP[newPoly[j + 1]] ^ GF_EXP[sum]]
        }
      }
    }
    poly = newPoly
  }
  return poly
}

function codewordsToBits(codewords) {
  var bits = []
  for (var i = 0; i < codewords.length; i++) {
    for (var j = 7; j >= 0; j--) {
      bits.push((codewords[i] >> j) & 1)
    }
  }
  return bits
}

function placeDataBits(matrix, reserved, bits, size) {
  var bitIdx = 0
  var col = size - 1
  while (col >= 0) {
    if (col === 6) col-- // 跳过 timing pattern 列
    for (var row = size - 1; row >= 0; row--) {
      for (var dc = 0; dc >= -1; dc--) {
        var c = col + dc
        if (c < 0 || c >= size) continue
        var r = ((size - 1 - col + (col > 6 ? 1 : 0)) % 2 === 0) ? size - 1 - row : row
        if (reserved[r][c]) continue
        if (bitIdx < bits.length) {
          matrix[r][c] = bits[bitIdx] === 1
          bitIdx++
        }
      }
    }
    col -= 2
  }
}

function applyMask(matrix, reserved, size, maskNum) {
  for (var r = 0; r < size; r++) {
    for (var c = 0; c < size; c++) {
      if (reserved[r][c]) continue
      var shouldFlip = false
      if (maskNum === 0) shouldFlip = (r + c) % 2 === 0
      if (shouldFlip) matrix[r][c] = !matrix[r][c]
    }
  }
}

function placeFormatInfo(matrix, size, maskNum) {
  // ECC Level L = 01, Mask 0 = 000 → format bits = 01000
  // After BCH: 0x5412 for L/mask0 → 111011111000010
  var FORMAT_BITS_L_MASK0 = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0]
  var bits = FORMAT_BITS_L_MASK0
  // Horizontal: row 8
  var hPositions = [0, 1, 2, 3, 4, 5, 7, 8, size - 8, size - 7, size - 6, size - 5, size - 4, size - 3, size - 2]
  for (var i = 0; i < 15; i++) {
    matrix[8][hPositions[i]] = bits[i] === 1
  }
  // Vertical: col 8
  var vPositions = [size - 1, size - 2, size - 3, size - 4, size - 5, size - 6, size - 7, 8, 7, 5, 4, 3, 2, 1, 0]
  for (var i = 0; i < 15; i++) {
    matrix[vPositions[i]][8] = bits[i] === 1
  }
}

module.exports = { generateQrMatrix: generateQrMatrix }
