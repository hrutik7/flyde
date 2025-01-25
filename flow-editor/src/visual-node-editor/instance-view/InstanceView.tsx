import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  entries,
  pickFirst,
  OMap,
  keys,
  nodeInput,
  isInlineNodeInstance,
  NodeStyle,
  getNodeOutputs,
  getInputName,
  getOutputName,
  NodeDefinition,
  isMacroNodeInstance,
} from "@flyde/core";
import classNames from "classnames";

import { PinView } from "../pin-view/PinView";
import {
  ConnectionData,
  Pos,
  NodesDefCollection,
  isStickyInputPinConfig,
  ERROR_PIN_ID,
  TRIGGER_PIN_ID,
  nodeOutput,
  isInputPinOptional,
} from "@flyde/core";
import {
  NodeInstance,
  isVisualNode,
  PinType,
  getNodeInputs,
} from "@flyde/core";
import { calcNodeContent } from "./utils";
import { BaseNodeView } from "../base-node-view";

import { getInstanceDomId } from "../dom-ids";
import {
  ClosestPinData,
  VisualNodeEditor,
  VisualNodeEditorProps,
} from "../VisualNodeEditor";
import { usePrompt } from "../..";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@flyde/ui";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@flyde/ui";

import { NodeStyleMenu } from "./NodeStyleMenu";
import { useDarkMode } from "../../flow-editor/DarkModeContext";
import {
  VisualNodeEditorContextType,
  VisualNodeEditorProvider,
} from "../VisualNodeEditorContext";

export const PIECE_HORIZONTAL_PADDING = 25;
export const PIECE_CHAR_WIDTH = 11;
export const MIN_WIDTH_PER_PIN = 40;
export const MAX_INSTANCE_WIDTH = 400; // to change in CSS as well

export const getVisibleInputs = (
  instance: NodeInstance,
  node: NodeDefinition,
  connections: ConnectionData[]
): string[] => {
  const { visibleInputs } = instance;

  if (visibleInputs) {
    return visibleInputs;
  }

  const visiblePins = keys(getNodeInputs(node)).filter((k, v) => {
    const isConnected = connections.some(
      (c) => c.to.insId === instance.id && c.to.pinId === k
    );
    // const isStatic = isStaticInputPinConfig(instance.inputConfig[k]);

    // const isRequired = node.inputs[k] && node.inputs[k]?.mode === "required";

    const isOptional = node.inputs[k] && node.inputs[k]?.mode === "optional";

    return isConnected || (!isOptional && k !== TRIGGER_PIN_ID);
  });

  return visiblePins;
};

export const getVisibleOutputs = (
  instance: NodeInstance,
  node: NodeDefinition,
  connections: ConnectionData[]
) => {
  const { visibleOutputs } = instance;

  if (visibleOutputs) {
    return visibleOutputs;
  }
  const keys = Object.keys(node.outputs);
  if (
    connections.some(
      (c) => c.from.insId === instance.id && c.from.pinId === ERROR_PIN_ID
    )
  ) {
    return [...keys, ERROR_PIN_ID];
  } else {
    return keys;
  }
};

export interface InstanceViewProps {
  instance: NodeInstance;
  node: NodeDefinition;
  selected?: boolean;
  dragged?: boolean;
  selectedInput?: string;
  selectedOutput?: string;
  connectionsPerInput: OMap<NodeInstance[]>;
  closestPin?: ClosestPinData;
  connections: ConnectionData[];
  viewPort: { pos: Pos; zoom: number };

  queuedInputsData: Record<string, number>;

  ancestorsInsIds?: string;

  resolvedDeps: NodesDefCollection;
  onPinClick: (v: NodeInstance, k: string, type: PinType) => void;
  onPinDblClick: (
    v: NodeInstance,
    k: string,
    type: PinType,
    e: React.MouseEvent
  ) => void;
  onDragEnd: (ins: NodeInstance, ...data: any[]) => void;
  onDragStart: (ins: NodeInstance, ...data: any[]) => void;
  onDragMove: (ins: NodeInstance, ev: React.MouseEvent, pos: Pos) => void;
  onSelect: (ins: NodeInstance, ev: React.MouseEvent) => void;
  onDblClick: (ins: NodeInstance, shiftKey: boolean) => void;
  onToggleSticky: (ins: NodeInstance, pinId: string) => void;
  onTogglePinLog: (insId: string, pinId: string, type: PinType) => void;
  onTogglePinBreakpoint: (insId: string, pinId: string, type: PinType) => void;

  onInspectPin: (insId: string, pin: { id: string; type: PinType }) => void;

  onUngroup: (ins: NodeInstance) => void;

  onChangeVisibleInputs: (ins: NodeInstance, inputs: string[]) => void;
  onChangeVisibleOutputs: (ins: NodeInstance, outputs: string[]) => void;

  onDeleteInstance: (ins: NodeInstance) => void;
  onSetDisplayName: (ins: NodeInstance, view: string | undefined) => void;

  onViewForkCode?: (ins: NodeInstance) => void;

  displayMode?: true;

  forceShowMinimized?: PinType | "both";

  isConnectedInstanceSelected: boolean;

  inlineGroupProps?: VisualNodeEditorProps & VisualNodeEditorContextType;
  onCloseInlineEditor: () => void;

  inlineEditorPortalDomNode: HTMLElement;

  onChangeStyle: (instance: NodeInstance, style: NodeStyle) => void;
  onGroupSelected: () => void;

  onPinMouseDown: (ins: NodeInstance, pinId: string, type: PinType) => void;
  onPinMouseUp: (ins: NodeInstance, pinId: string, type: PinType) => void;

  hadError: boolean;
}

export const InstanceView: React.FC<InstanceViewProps> =
  function InstanceViewInner(props) {
    const {
      selected,
      selectedInput,
      selectedOutput,
      closestPin,
      dragged,
      onTogglePinLog,
      onTogglePinBreakpoint,
      displayMode,
      connections,
      instance,
      viewPort,
      node,
      onPinClick,
      onPinDblClick,
      onDragStart,
      onDragEnd,
      onDragMove,
      onToggleSticky,
      onSelect,
      onDblClick: onDoubleClick,
      onChangeVisibleInputs,
      onChangeVisibleOutputs,
      inlineGroupProps,
      onUngroup,
      onGroupSelected,
      isConnectedInstanceSelected,
      onChangeStyle,
      onDeleteInstance,
      onSetDisplayName,
      onPinMouseUp,
      onPinMouseDown,
    } = props;

    const dark = useDarkMode();

    const { id } = instance;

    const inlineEditorRef = React.useRef();

    const style = React.useMemo(() => {
      return {
        icon: instance.style?.icon ?? node.defaultStyle?.icon,
        color: instance.style?.color ?? node.defaultStyle?.color,
        size: instance.style?.size ?? node.defaultStyle?.color ?? "regular",
        cssOverride:
          instance.style?.cssOverride ?? node.defaultStyle?.cssOverride,
      } as NodeStyle;
    }, [node, instance]);

    const connectedInputs = React.useMemo(() => {
      return new Map(
        connections
          .filter(({ to }) => to.insId === id)
          .map(({ to, hidden }) => [to.pinId, hidden])
      );
    }, [connections, id]);

    const connectedOutputs = React.useMemo(() => {
      return new Map(
        connections
          .filter(({ from }) => from.insId === id)
          .map(({ from, hidden }) => [from.pinId, hidden])
      );
    }, [connections, id]);

    const _prompt = usePrompt();

    const onInputClick = React.useCallback(
      (pin: string) => onPinClick(instance, pin, "input"),
      [instance, onPinClick]
    );

    const onInputDblClick = React.useCallback(
      (pin: string, e) => onPinDblClick(instance, pin, "input", e),
      [instance, onPinDblClick]
    );

    const onOutputDblClick = React.useCallback(
      (pin: string, e) => onPinDblClick(instance, pin, "output", e),
      [instance, onPinDblClick]
    );

    const onOutputClick = React.useCallback(
      (pin: string) => onPinClick(instance, pin, "output"),
      [instance, onPinClick]
    );

    const _onDragStart = React.useCallback(
      (event: any, data: any) => {
        onDragStart(instance, event, data);
      },
      [instance, onDragStart]
    );

    const _onDragEnd = React.useCallback(
      (event: any, data: any) => {
        const currPos = instance.pos;
        const dx = (data.x - currPos.x) / viewPort.zoom;
        const dy = (data.y - currPos.y) / viewPort.zoom;
        const newX = currPos.x + dx;
        const newY = currPos.y + dy;
        onDragEnd(instance, event, { ...data, x: newX, y: newY });
      },
      [instance, onDragEnd, viewPort.zoom]
    );

    const _onDragMove = React.useCallback(
      (event: any, data: any) => {
        onDragMove(instance, event, { x: data.x, y: data.y });
      },
      [instance, onDragMove]
    );

    const _onToggleSticky = React.useCallback(
      (pinId: string) => onToggleSticky(instance, pinId),
      [instance, onToggleSticky]
    );

    const _onSelect = React.useCallback(
      (e: any) => onSelect(instance, e),
      [instance, onSelect]
    );

    const onDblClick = React.useCallback(
      (e: React.MouseEvent) => onDoubleClick(instance, e.shiftKey),
      [instance, onDoubleClick]
    );

    const is = entries(node.inputs);

    const { visibleInputs, visibleOutputs } = instance;

    if (visibleInputs) {
      is.sort(
        (a, b) => visibleInputs.indexOf(a[0]) - visibleInputs.indexOf(b[0])
      );
    }

    const os = entries(node.outputs);

    if (visibleOutputs) {
      os.sort(
        (a, b) => visibleOutputs.indexOf(a[0]) - visibleOutputs.indexOf(b[0])
      );
    }

    const _visibleInputs = getVisibleInputs(instance, node, connections);

    const _visibleOutputs = getVisibleOutputs(instance, node, connections);

    is.push([
      TRIGGER_PIN_ID,
      {
        ...nodeInput(),
        description:
          "Use this pin to manually trigger the node. If not connected, the node will be triggered automatically when all required inputs have data.",
      },
    ]);

    os.push([
      ERROR_PIN_ID,
      {
        ...nodeOutput(),
        description:
          "Use this pin to catch errors that happen inside this node. If not connected, errors will bubble up to the parent node.",
      },
    ]);

    const inputsToRender = is.filter(([k]) => {
      return (
        _visibleInputs.includes(k) ||
        ((selected || isConnectedInstanceSelected) && connectedInputs.has(k))
      );
    });

    const outputsToRender = os.filter(([k]) => {
      return (
        _visibleOutputs.includes(k) ||
        ((selected || isConnectedInstanceSelected) &&
          connectedOutputs.has(k)) ||
        (k === ERROR_PIN_ID && props.hadError)
      );
    });

    const isErrorCaught = connections.some(
      (conn) => conn.from.insId === id && conn.from.pinId === ERROR_PIN_ID
    );

    const cm = classNames("ins-view", {
      "no-inputs": inputsToRender.length === 0,
      "no-outputs": outputsToRender.length === 0,
      "display-mode": displayMode,
      "force-minimized-input":
        props.forceShowMinimized === "input" ||
        props.forceShowMinimized === "both",
      "force-minimized-output":
        props.forceShowMinimized === "output" ||
        props.forceShowMinimized === "both",
      "inline-node-edited": !!inlineGroupProps,
      "error-caught": isErrorCaught,
      selected,
      dragged,
      closest: closestPin && closestPin.ins.id === instance.id,
    });

    const optionalInputs = new Set(
      entries(node.inputs)
        .filter(([_, v]) => isInputPinOptional(v))
        .map(pickFirst)
    );

    const stickyInputs = entries(instance.inputConfig).reduce<{
      [k: string]: boolean;
    }>((p, [k, v]) => {
      if (isStickyInputPinConfig(v) || (v as any).sticky) {
        return { ...p, [k]: true };
      }
      return p;
    }, {});

    try {
      // customView =
      //   node.customView &&
      //   node.customView(instance, connectionsPerInput, connectionsPerOutput);
    } catch (e) {
      console.error(`Error rendering custom view for node ${node.id}`);
    }

    const content = calcNodeContent(instance, node);

    const _onChangeVisibleInputs = React.useCallback(async () => {
      const inputs = keys(node.inputs);
      const res = await _prompt(
        "New order?",
        (instance.visibleInputs || inputs).join(",")
      );
      if (res) {
        onChangeVisibleInputs(instance, res.split(","));
      }
    }, [node.inputs, _prompt, instance, onChangeVisibleInputs]);

    const _onChangeVisibleOutputs = React.useCallback(async () => {
      const outputs = keys(node.outputs);
      const res = await _prompt(
        "New order?",
        (instance.visibleOutputs || outputs).join(",")
      );
      if (res) {
        onChangeVisibleOutputs(instance, res.split(","));
      }
    }, [node.outputs, _prompt, instance, onChangeVisibleOutputs]);

    const _onDeleteInstance = React.useCallback(() => {
      onDeleteInstance(instance);
    }, [onDeleteInstance, instance]);

    const _onSetDisplayName = React.useCallback(async () => {
      const name = await _prompt(
        `Set custom display name`,
        instance.displayName || node.id
      );
      onSetDisplayName(instance, name);
    }, [_prompt, instance, onSetDisplayName, node.id]);

    const inputKeys = Object.keys(getNodeInputs(node));
    const outputKeys = Object.keys(getNodeOutputs(node));

    const _onPinMouseUp = React.useCallback(
      (pinId: string, pinType: PinType) => {
        if (onPinMouseUp) {
          onPinMouseUp(instance, pinId, pinType);
        }
      },
      [instance, onPinMouseUp]
    );

    const _onPinMouseDown = React.useCallback(
      (pinId: string, pinType: PinType) => {
        if (onPinMouseDown) {
          onPinMouseDown(instance, pinId, pinType);
        }
      },
      [instance, onPinMouseDown]
    );

    const getContextMenu = React.useCallback(() => {
      const inputMenuItems = inputKeys.map((k) => {
        const isVisible = _visibleInputs.includes(k);
        const isConnectedAndNotHidden =
          connectedInputs.has(k) && connectedInputs.get(k) !== true;

        const pinName = getInputName(k);

        return (
          <ContextMenuItem
            key={k}
            disabled={isConnectedAndNotHidden && isVisible}
            onClick={() =>
              onChangeVisibleInputs(
                instance,
                isVisible
                  ? _visibleInputs.filter((i) => i !== k)
                  : [..._visibleInputs, k]
              )
            }
          >
            {isVisible
              ? isConnectedAndNotHidden
                ? `Hide input "${pinName}" (disconnect first)`
                : `Hide input "${pinName}"`
              : `Show input "${pinName}"`}
          </ContextMenuItem>
        );
      });

      const outputMenuItems = outputKeys.map((k) => {
        const isVisible = _visibleOutputs.includes(k);
        const isConnected = connectedOutputs.has(k);

        const pinName = getOutputName(k);

        return (
          <ContextMenuItem
            key={k}
            disabled={isConnected && isVisible}
            onClick={() =>
              onChangeVisibleOutputs(
                instance,
                isVisible
                  ? _visibleOutputs.filter((i) => i !== k)
                  : [..._visibleOutputs, k]
              )
            }
          >
            {isVisible
              ? isConnected
                ? `Hide output "${pinName}" (disconnect first)`
                : `Hide output "${pinName}"`
              : `Show output "${pinName}"`}
          </ContextMenuItem>
        );
      });

      return (
        <ContextMenuContent>
          {isMacroNodeInstance(instance) && (
            <ContextMenuItem onClick={(e) => onDblClick(e)}>
              Change configuration
            </ContextMenuItem>
          )}
          <ContextMenuSub>
            <ContextMenuSubTrigger>Style</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <NodeStyleMenu
                style={style}
                onChange={(s) => onChangeStyle(instance, s)}
                promptFn={_prompt}
              />
            </ContextMenuSubContent>
          </ContextMenuSub>
          {inputMenuItems}
          {outputMenuItems}
          {isInlineNodeInstance(instance) && isVisualNode(instance.node) && (
            <ContextMenuItem onClick={() => onUngroup(instance)}>
              Ungroup inline node
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={_onChangeVisibleInputs}>
            Reorder inputs
          </ContextMenuItem>
          <ContextMenuItem onClick={_onChangeVisibleOutputs}>
            Reorder outputs
          </ContextMenuItem>
          <ContextMenuItem onClick={_onSetDisplayName}>
            Set display name
          </ContextMenuItem>
          <ContextMenuItem onClick={onGroupSelected}>
            Group selected instances
          </ContextMenuItem>
          <ContextMenuItem onClick={() => props.onViewForkCode(instance)}>
            View/fork code
          </ContextMenuItem>
          <ContextMenuItem className="text-red-500" onClick={_onDeleteInstance}>
            Delete instance
          </ContextMenuItem>
        </ContextMenuContent>
      );
    }, [
      inputKeys,
      outputKeys,
      instance,
      _onChangeVisibleInputs,
      _onChangeVisibleOutputs,
      _onSetDisplayName,
      onGroupSelected,
      _onDeleteInstance,
      style,
      _prompt,
      _visibleInputs,
      connectedInputs,
      onChangeVisibleInputs,
      _visibleOutputs,
      connectedOutputs,
      onChangeVisibleOutputs,
      onUngroup,
      props,
      onDblClick,
      onChangeStyle,
    ]);

    const instanceDomId = getInstanceDomId(instance.id, props.ancestorsInsIds);

    const maybeRenderInlineGroupEditor = () => {
      if (inlineGroupProps) {
        return (
          <Dialog open={true} onOpenChange={() => props.onCloseInlineEditor()}>
            <DialogContent className="inline-group-editor-container no-drag">
              <DialogHeader>
                <DialogTitle>Editing inline node {content}</DialogTitle>
              </DialogHeader>
              <div className="p-4" tabIndex={0}>
                <VisualNodeEditorProvider
                  boardData={inlineGroupProps.boardData}
                  onChangeBoardData={inlineGroupProps.onChangeBoardData}
                  node={inlineGroupProps.node}
                  onChangeNode={inlineGroupProps.onChangeNode}
                >
                  <VisualNodeEditor
                    {...props.inlineGroupProps}
                    className="no-drag"
                    ref={inlineEditorRef}
                  />
                </VisualNodeEditorProvider>
              </div>
            </DialogContent>
          </Dialog>
        );
      } else {
        return null;
      }
    };

    const nodeIdForDomDataAttr = isMacroNodeInstance(instance)
      ? instance.macroId
      : node.id;

    const renderInputs = () => {
      if (!inputsToRender.length) {
        return null;
      }
      return (
        <div className="inputs no-drag">
          {inputsToRender.map(([k, v]) => (
            <div className="pin-container inputs" key={k}>
              <PinView
                type="input"
                currentInsId={instance.id}
                ancestorsInsIds={props.ancestorsInsIds}
                id={k}
                optional={optionalInputs.has(k)}
                connected={connectedInputs.has(k)}
                isSticky={stickyInputs[k]}
                // minimized={!selected}
                onToggleSticky={_onToggleSticky}
                selected={k === selectedInput}
                onClick={onInputClick}
                onDoubleClick={onInputDblClick}
                isClosestToMouse={
                  !!closestPin &&
                  closestPin.type === "input" &&
                  closestPin.pin === k
                }
                onToggleLogged={onTogglePinLog}
                onToggleBreakpoint={onTogglePinBreakpoint}
                onInspect={props.onInspectPin}
                description={v.description}
                queuedValues={props.queuedInputsData[k] ?? 0}
                onMouseUp={_onPinMouseUp}
                onMouseDown={_onPinMouseDown}
                isMain={false}
              />
            </div>
          ))}
        </div>
      );
    };

    const renderOutputs = () => {
      if (!outputsToRender.length) {
        return null;
      }
      return (
        <div className="outputs no-drag">
          {outputsToRender.map(([k, v]) => (
            <div className="pin-container outputs" key={k}>
              <PinView
                currentInsId={instance.id}
                ancestorsInsIds={props.ancestorsInsIds}
                connected={connectedOutputs.has(k)}
                type="output"
                id={k}
                // minimized={selected ? false : outputsToRender.length === 1}
                isClosestToMouse={
                  !!closestPin &&
                  closestPin.type === "output" &&
                  closestPin.pin === k
                }
                selected={k === selectedOutput}
                onClick={onOutputClick}
                onDoubleClick={onOutputDblClick}
                onToggleLogged={onTogglePinLog}
                onToggleBreakpoint={onTogglePinBreakpoint}
                onInspect={props.onInspectPin}
                description={v.description}
                onMouseUp={_onPinMouseUp}
                onMouseDown={_onPinMouseDown}
                isMain={false}
              />
            </div>
          ))}
        </div>
      );
    };

    return (
      <div
        className={cm}
        data-node-id={nodeIdForDomDataAttr}
        data-instance-id={instance.id}
      >
        <BaseNodeView
          pos={instance.pos}
          viewPort={viewPort}
          onDragStart={_onDragStart}
          onDragMove={_onDragMove}
          onDragEnd={_onDragEnd}
          displayMode={displayMode}
          domId={instanceDomId}
          heading={content}
          description={node.description}
          icon={style.icon}
          leftSide={renderInputs()}
          rightSide={renderOutputs()}
          selected={selected}
          dark={dark}
          contextMenuContent={getContextMenu()}
          onClick={_onSelect}
          overrideNodeBodyHtml={node.overrideNodeBodyHtml}
          overrideStyle={style.cssOverride}
          onDoubleClick={onDblClick}
        />
        {maybeRenderInlineGroupEditor()}
      </div>
    );
  };

export const InstanceIcon: React.FC<{ icon?: string }> = function InstanceIcon({
  icon,
}) {
  if (!icon) {
    return <FontAwesomeIcon icon="code" size="lg" />;
  }
  if (typeof icon === "string" && icon.trim().startsWith("<")) {
    return (
      <span
        className="svg-icon-container"
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    );
  } else {
    return <FontAwesomeIcon icon={icon as any} size="lg" />;
  }
};
