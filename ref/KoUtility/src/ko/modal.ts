import ko from "knockout";
//binding on an element, when set to true, calls showModal() on false close()
ko.bindingHandlers.modal = {
  init: function (el, acc) {
    var dlg = el as HTMLDialogElement;
    if (dlg) {
      var val = ko.unwrap(acc());
      !!val ? dlg.showModal() : dlg.close();
    }
  },
  update: function (el, acc) {
    var dlg = el as HTMLDialogElement;
    if (dlg) {
      var val = ko.unwrap(acc());
      !!val ? dlg.showModal() : dlg.close();
    }
  },
};
