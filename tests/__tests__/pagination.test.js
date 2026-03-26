// tests/__tests__/pagination.test.js - pagination.js 单元测试
const { paginate } = require('../../cloudfunctions/_shared/pagination')

describe('Pagination - Unit Tests', () => {
  describe('paginate', () => {
    test('first page with more data returns correct skip, limit, and hasMore=true', () => {
      const result = paginate(50, 1, 20)
      expect(result).toEqual({ skip: 0, limit: 20, hasMore: true })
    })

    test('second page with more data returns correct skip', () => {
      const result = paginate(50, 2, 20)
      expect(result).toEqual({ skip: 20, limit: 20, hasMore: true })
    })

    test('last page returns hasMore=false', () => {
      const result = paginate(50, 3, 20)
      expect(result).toEqual({ skip: 40, limit: 20, hasMore: false })
    })

    test('exact page boundary returns hasMore=false', () => {
      // 40 items, page 2, pageSize 20 → 2*20=40 is NOT < 40
      const result = paginate(40, 2, 20)
      expect(result).toEqual({ skip: 20, limit: 20, hasMore: false })
    })

    test('single page of data returns hasMore=false', () => {
      const result = paginate(5, 1, 20)
      expect(result).toEqual({ skip: 0, limit: 20, hasMore: false })
    })

    test('total is zero returns hasMore=false', () => {
      const result = paginate(0, 1, 20)
      expect(result).toEqual({ skip: 0, limit: 20, hasMore: false })
    })

    test('pageSize of 1 with multiple items', () => {
      const result = paginate(3, 1, 1)
      expect(result).toEqual({ skip: 0, limit: 1, hasMore: true })
    })

    test('pageSize of 1 on last item', () => {
      const result = paginate(3, 3, 1)
      expect(result).toEqual({ skip: 2, limit: 1, hasMore: false })
    })

    test('large page number beyond data returns hasMore=false', () => {
      const result = paginate(10, 5, 20)
      expect(result).toEqual({ skip: 80, limit: 20, hasMore: false })
    })

    test('pageSize equals total returns hasMore=false on first page', () => {
      const result = paginate(20, 1, 20)
      expect(result).toEqual({ skip: 0, limit: 20, hasMore: false })
    })

    test('limit always equals pageSize', () => {
      expect(paginate(100, 1, 50).limit).toBe(50)
      expect(paginate(10, 1, 50).limit).toBe(50)
      expect(paginate(0, 1, 50).limit).toBe(50)
    })
  })
})
