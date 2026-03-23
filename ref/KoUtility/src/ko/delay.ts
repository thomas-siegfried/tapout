import ko from "knockout";
//delay extender, good for UI hacks
ko.extenders["delay"] = function (
  target: KnockoutObservable<any>,
  option: number = 50
) {
  var newComputed = ko.computed({
    read: () => target(),
    write: (val) => {
      if (val != target()) {
        setTimeout(() => target(val), option);
      }
    },
  });
  return newComputed;
};
