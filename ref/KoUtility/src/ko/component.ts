/// <reference types="knockout" />
import ko from "knockout";
import { Root } from "@thomas-siegfried/jsi";
//Embed the tag in the class function, so that we can use it other places
export const templateTagSymbol = Symbol("tag");

export function KoComponent(tag: string, template?: string) {
  return function (target: Function) {
    target.prototype[templateTagSymbol] = tag;
    var templateArg = !!template ? template : { element: tag }; //use template string if provided, else tag
    ko.components.register(tag, {
      template: templateArg,
      viewModel: {
        createViewModel: function (
          params: any,
          componentInfo: KnockoutComponentTypes.ComponentInfo
        ) {
          var viewModel: any;
          //create and pass params
          viewModel = Root.Resolve<any>(target as any);
          Object.assign(viewModel, params);

          //init the view model if it wants it
          if (IsInitialize(viewModel)) {
            viewModel.initialize(componentInfo);
          }
          return viewModel;
        },
      },
    });
  };
}
//interface for components that need to be initialized after being created.
export interface InitializeComponent {
  initialize(info: KnockoutComponentTypes.ComponentInfo): void;
}
function IsInitialize(obj: any): obj is InitializeComponent {
  return !!obj.initialize && typeof obj.initialize === "function";
}
