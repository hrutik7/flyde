import { FlydeNode } from "@flyde/core";

import { NodeInstance } from "@flyde/core/dist/node";

export type ReferencedNodeFinder = (
  instance: NodeInstance,
) => FlydeNode;
