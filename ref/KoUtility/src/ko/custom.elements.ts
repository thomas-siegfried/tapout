import ko from "knockout";
(ko.bindingProvider.instance as any)["preprocessNode"] = (node: Node) => {
  // if it contains a hyphen, we consider it to be a component
  if (node.nodeName.includes("-")) {
    var el: HTMLElement = node as HTMLElement;
    el.style.display = "contents";
  }
};
