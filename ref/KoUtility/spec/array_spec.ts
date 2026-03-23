import "../src/arrays.js";
describe("array utilities", () => {
  describe("distinct", () => {
    it("dedupes numbers", () => {
      var ary = [1, 1, 2, 3, 4, 5, 6];
      expect(ary.distinct().length).toBe(6);
    });
    it("dedupes objects", () => {
      var obj1 = {},
        obj2 = {};
      var ary = [obj1, obj2, obj1, obj2, obj1];
      expect(ary.distinct().length).toBe(2);
    });
    it("does not dedupes objects based on values", () => {
      var obj1 = { x: 1 },
        obj2 = { x: 1 };
      var ary = [obj1, obj2, obj1, obj2, obj1];
      expect(ary.distinct().length).toBe(2);
    });
  });
  describe("sortBy", () => {
    it("can sort by a string prop", () => {
      var obj1 = { x: "a" },
        obj2 = { x: "b" },
        obj3 = { x: "c" };
      var ary = [obj1, obj3, obj2];
      ary = ary.sortBy((a) => a.x);
      expect(ary.at(0)?.x).toBe("a");
      expect(ary.at(1)?.x).toBe("b");
      expect(ary.at(2)?.x).toBe("c");
    });
    it("can sort by a number prop", () => {
      var obj1 = { x: 1 },
        obj2 = { x: 2 },
        obj3 = { x: 3 };
      var ary = [obj3, obj1, obj2];
      ary = ary.sortBy((a) => a.x.toString());
      expect(ary.at(0)?.x).toBe(1);
      expect(ary.at(1)?.x).toBe(2);
      expect(ary.at(2)?.x).toBe(3);
    });
    it("does a correct numberic sort and not a string sort on numbers", () => {
      var obj1 = { x: 113 },
        obj2 = { x: 2 },
        obj3 = { x: 1.523 };
      var ary = [obj3, obj1, obj2];
      ary = ary.sortBy((a) => a.x);
      expect(ary.at(0)).toBe(obj3);
      expect(ary.at(1)).toBe(obj2);
      expect(ary.at(2)).toBe(obj1);
    });
    it("sorts dates correctly", () => {
      var obj1 = { x: new Date(2012, 5, 1) },
        obj2 = { x: new Date(2011, 5, 1) },
        obj3 = { x: new Date(2017, 5, 1) };
      var ary = [obj3, obj1, obj2];
      ary = ary.sortBy((a) => a.x);
      expect(ary.at(0)).toBe(obj2);
      expect(ary.at(1)).toBe(obj1);
      expect(ary.at(2)).toBe(obj3);
    });
  });
  describe("sum", () => {
    it("can add numbers good", () => {
      var ary = [{ x: 5 }, { x: 12 }, { x: 1 }];
      const sum = ary.sum((a) => a.x);
      expect(sum).toBe(18);
    });
  });
});
