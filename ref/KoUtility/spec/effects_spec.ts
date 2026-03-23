import ko from "knockout";
import { observe, effect, observeOnce } from "../src/ko/effects.js";
describe("effects", () => {
  it("observe triggers when value changes", () => {
    const obs = ko.observable(0);
    var spy = jasmine.createSpy();
    observe(() => obs(), spy);
    expect(spy).not.toHaveBeenCalled();
    obs(1);
    expect(spy).toHaveBeenCalled();
  });
  it("can observe an observable directly", () => {
    const obs = ko.observable(0);
    var spy = jasmine.createSpy();
    observe(obs, spy);
    expect(spy).not.toHaveBeenCalled();
    obs(1);
    expect(spy).toHaveBeenCalled();
  });
  it("effects run immediate and also on change", () => {
    const obs = ko.observable(0);
    var spy = jasmine.createSpy();
    effect(obs, spy);
    expect(spy).toHaveBeenCalled();
    obs(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it("observe once only triggers once", () => {
    const obs = ko.observable(0);
    var spy = jasmine.createSpy();
    observeOnce(obs, spy);
    expect(spy).not.toHaveBeenCalled();
    obs(1);
    expect(spy).toHaveBeenCalledTimes(1);
    obs(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
