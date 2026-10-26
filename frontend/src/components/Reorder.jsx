import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box, IconButton, Tooltip } from "@mui/material";
import DragIndicatorRounded from "@mui/icons-material/DragIndicatorRounded";
export function SortableGroup({ items, onReorder, disabled, children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) =>
            `Picked up ${items.find((item) => item.id === active.id)?.name || "item"}. Use arrow keys to move, then Space to drop.`,
          onDragOver: ({ active, over }) =>
            over && over.id !== active.id
              ? `Moving ${items.find((item) => item.id === active.id)?.name || "item"} over ${items.find((item) => item.id === over.id)?.name || "item"}.`
              : undefined,
          onDragEnd: ({ active }) =>
            `Dropped ${items.find((item) => item.id === active.id)?.name || "item"}.`,
          onDragCancel: () => "Reordering cancelled.",
        },
      }}
      onDragEnd={({ active, over }) => {
        if (disabled || !over || active.id === over.id) return;
        const ids = items.map((i) => i.id);
        onReorder(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
      }}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}
export function SortableRow({ id, label, disabled, children, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });
  const handle = (
    <Tooltip title="Drag to reorder · Space, then arrow keys">
      <IconButton
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${label}`}
        disabled={disabled}
        className="drag-handle"
        size="small"
        sx={{
          touchAction: "none",
          cursor: disabled ? "default" : "grab",
          color: "text.secondary",
          opacity: 0.6,
          width: 32,
          flexShrink: 0,
        }}
      >
        <DragIndicatorRounded
          sx={{
            fontSize: 19,
          }}
        />
      </IconButton>
    </Tooltip>
  );
  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      sx={{
        position: "relative",
        zIndex: isDragging ? 3 : "auto",
        boxShadow: isDragging ? "0 8px 28px #292B2820" : undefined,
        bgcolor: isDragging ? "background.paper" : undefined,
        opacity: isDragging ? 0.85 : 1,
      }}
      {...props}
    >
      {children(handle)}
    </Box>
  );
}
