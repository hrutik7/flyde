import { CodeNode } from "@flyde/core";

export * from "./Conditional/Conditional.flyde";
export * from "./Switch.flyde";
export * from "./RoundRobin.flyde";

const PubSub = require("pubsub-js");

const namespace = "Control Flow";

export const LimitTimes: CodeNode = {
  id: "Limit Times",
  namespace,
  description: "Item will be emitted until the limit is reached",
  inputs: {
    item: { mode: "required", description: "The item to emit" },
    times: {
      mode: "required",
      description: "The number of times to emit the item",
    },
    reset: { mode: "optional", description: "Reset the counter" },
  },
  outputs: { ok: {} },
  reactiveInputs: ["item", "reset"],
  completionOutputs: [],
  run: function (inputs, outputs, adv) {
    // magic here
    const { state } = adv;
    const { item, times, reset } = inputs;
    const { ok } = outputs;

    if (typeof reset !== "undefined") {
      state.set("val", 0);
      return;
    }

    let curr = state.get("val") || 0;
    curr++;
    state.set("val", curr);
    if (curr >= times) {
      adv.onError(new Error(`Limit of ${times} reached`));
    } else {
      ok.next(item);
    }
  },
};

export const Publish: CodeNode = {
  id: "Publish",
  namespace,
  description:
    "Publishes a value by a key to all listeners in the current flow. Use 'Subscribe' to listen to events.",
  inputs: {
    key: {
      mode: "required",
      description: "A key to use to subscribe to values",
    },
    value: { mode: "required" },
  },
  outputs: {},
  run: function (inputs, _, adv) {
    // magic here
    const nsKey = `${adv.ancestorsInsIds}__${inputs.key}`;

    PubSub.publish(nsKey, inputs.value);
  },
};

export const Subscribe: CodeNode = {
  id: "Subscribe",
  namespace,
  description:
    "Subscribes to a value published by a key. Use 'Publish' to publish values.",
  inputs: {
    key: {
      mode: "required",
      description: "A key to use to subscribe to values",
    },
    initial: {
      mode: "required-if-connected",
      description: "If passed will be published has the first value",
    },
  },
  completionOutputs: [],
  outputs: { value: { description: "The value published by the key" } },
  run: function (inputs, outputs, adv) {
    const { value } = outputs;
    const nsKey = `${adv.ancestorsInsIds}__${inputs.key}`;
    const token = PubSub.subscribe(nsKey, (_, data) => {
      value.next(data);
    });

    if (typeof inputs.initial !== "undefined") {
      value.next(inputs.initial);
    }

    adv.onCleanup(() => {
      PubSub.unsubscribe(token);
    });
  },
};

export const BooleanSplit: CodeNode = {
  namespace,
  id: "Boolean Split",
  description: "Splits a boolean value into two outputs",
  inputs: {
    value: { mode: "required", description: "Boolean value" },
    trueValue: {
      mode: "required-if-connected",
      description: "Value to emit if the input is true. Defaults to true",
    },
    falseValue: {
      mode: "required-if-connected",
      description: "Value to emit if the input is false. Defaults to false",
    },
  },
  outputs: {
    true: { description: "The value is true" },
    false: { description: "The value is false" },
  },
  run: function (inputs, outputs) {
    const { true: trueOutput, false: falseOutput } = outputs;
    const { value, trueValue, falseValue } = inputs;
    if (value) {
      trueOutput.next(trueValue ?? true);
    } else {
      falseOutput.next(falseValue ?? false);
    }
  },
};

export const EmitOnTrigger: CodeNode = {
  namespace,
  id: "Emit on Trigger",
  description: "Emits the value when the trigger input receives any value",
  inputs: {
    value: { mode: "required", description: "The value to emit" },
    trigger: { mode: "required", description: "The trigger to emit the value" },
  },
  outputs: {
    result: { description: "The value emitted" },
  },
  run: function (inputs, outputs) {
    const { result } = outputs;
    const { value, trigger } = inputs;
    if (trigger !== undefined) {
      result.next(value);
    }
  },
};
