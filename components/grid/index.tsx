import clsx from "clsx";

function Grid(props: React.ComponentProps<"ul">) {
  return (
    <ul
      {...props}
      className={clsx("grid gap-4", props.className)}
    >
      {props.children}
    </ul>
  );
}

function GridItem({
  square = true,
  className,
  ...props
}: React.ComponentProps<"li"> & { square?: boolean }) {
  return (
    <li
      {...props}
      className={clsx(square && "aspect-square", "transition-opacity", className)}
    >
      {props.children}
    </li>
  );
}

Grid.Item = GridItem;

export default Grid;
