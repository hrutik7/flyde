import { dynamicPartInput, Part } from ".";

import { spy } from "sinon";

import { execute } from "../execute";

import { Subject } from "rxjs";

import { assert } from "chai";
import { PartsCollection } from "..";
import { queueInputPinConfig, stickyInputPinConfig } from "./pin-config";

export const runAddTests = (
  add: Part,
  source: string,
  resolvedDeps: PartsCollection
) => {
  describe(`Add tests: ${source}`, () => {
    it("runs fn when dynamic inputs are given", () => {
      const fn = spy();

      const n1 = dynamicPartInput();
      const n2 = dynamicPartInput();

      const r = new Subject();
      r.subscribe(fn);
      execute({
        part: add,
        inputs: { n1, n2 },
        outputs: { r },
        resolvedDeps: resolvedDeps,
      });
      n1.subject.next(1);
      n2.subject.next(2);

      assert.equal(fn.callCount, 1);
      assert.equal(fn.lastCall.args[0], 3);
    });

    it("waits for all inputs to be have value before running", () => {
      const fn = spy();

      const n1 = dynamicPartInput();
      const n2 = dynamicPartInput();

      const r = new Subject();
      r.subscribe(fn);
      execute({
        part: add,
        inputs: { n1, n2 },
        outputs: { r },
        resolvedDeps: resolvedDeps,
      });
      assert.equal(fn.callCount, 0);
      n1.subject.next(1);
      assert.equal(fn.callCount, 0);
      n2.subject.next(2);

      assert.equal(fn.callCount, 1);
      assert.equal(fn.lastCall.args[0], 3);
    });

    it("pins do not hold their value after usage", () => {
      const fn = spy();

      const n1 = dynamicPartInput();
      const n2 = dynamicPartInput();

      const r = new Subject();
      r.subscribe(fn);
      execute({
        part: add,
        inputs: { n1, n2 },
        outputs: { r },
        resolvedDeps: resolvedDeps,
      });
      n1.subject.next(1);
      n2.subject.next(2);
      n2.subject.next(10);

      assert.equal(fn.callCount, 1);
      assert.equal(fn.lastCall.args[0], 3);

      n1.subject.next(20);
      assert.equal(fn.callCount, 2);
      assert.equal(fn.lastCall.args[0], 30);
    });

    it.skip("pins hold their value after usage by default", () => {
      const fn = spy();

      const n1 = dynamicPartInput({ config: stickyInputPinConfig() });
      const n2 = dynamicPartInput({ config: stickyInputPinConfig() });

      const r = new Subject();
      r.subscribe(fn);
      execute({
        part: add,
        inputs: { n1, n2 },
        outputs: { r },
        resolvedDeps: resolvedDeps,
      });
      n1.subject.next(1);
      n2.subject.next(2);
      n2.subject.next(3);

      assert.equal(fn.callCount, 2);
      assert.equal(fn.lastCall.args[0], 4);

      n1.subject.next(2);
      assert.equal(fn.callCount, 3);
      assert.equal(fn.lastCall.args[0], 5);
    });

    it.skip("works when only 1 pin should hold be sticky", () => {
      const fn = spy();

      const n1 = dynamicPartInput({ config: stickyInputPinConfig() });
      const n2 = dynamicPartInput({ config: queueInputPinConfig() });

      const r = new Subject();
      r.subscribe(fn);
      execute({
        part: add,
        inputs: { n1, n2 },
        outputs: { r },
        resolvedDeps: resolvedDeps,
      });
      n1.subject.next(1);
      n2.subject.next(2);

      n2.subject.next(3);

      assert.equal(fn.callCount, 2);
      assert.equal(fn.lastCall.args[0], 4);

      n1.subject.next(2);
      assert.equal(fn.callCount, 2);
      assert.equal(fn.lastCall.args[0], 4);

      n2.subject.next(5);

      assert.equal(fn.callCount, 3);
      assert.equal(fn.lastCall.args[0], 7);
    });
  });
};
