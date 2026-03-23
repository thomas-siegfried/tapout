import { Bind } from "../src/bind.js";

describe("bind", () => {
  class MyClass {
    @Bind
    public GetMe() {
      return this;
    }
  }
  it("captures this", () => {
    var cls = new MyClass();
    var getme = cls.GetMe;
    expect(getme()).toBe(cls);
  });
});
