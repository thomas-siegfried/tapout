import ko from "knockout";
//binds enter key to the event
ko.bindingHandlers.enter = {
  init: function (el: HTMLElement, acc) {
    el.addEventListener("keypress", (evt: KeyboardEvent) => {
      if (evt.key == "Enter") {
        acc()();
      }
    });
  },
};
export {};
