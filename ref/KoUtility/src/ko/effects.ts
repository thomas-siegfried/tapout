import ko from "knockout";
export function observe<T>(
  fn: () => T,
  act: (val: T) => any
): KnockoutSubscription {
  return ko.pureComputed(fn).extend({ notify: "always" }).subscribe(act);
}
//same as observe, but also runs once immediate
export function effect<T>(
  fn: () => T,
  act: (val: T) => any
): KnockoutSubscription {
  act(fn());
  return ko.pureComputed(fn).extend({ notify: "always" }).subscribe(act);
}

export function observeOnce<T>(fn: () => T, act: (val: T) => any) {
  var c = ko.pureComputed(fn).extend({ notify: "always" });
  c.subscribe((val) => {
    act(val);
    c.dispose();
  });
}
