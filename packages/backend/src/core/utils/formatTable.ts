import table from "fast-text-table";

type TableColumn<T> = {
    header: string;
    value: (row: T) => string | number;
};

//Turns an array of objects into a table.
export const formatTable = <T>(rows: T[], columns: TableColumn<T>[]) => {
    const data = [columns.map(c => c.header), ...rows.map(row => columns.map(c => c.value(row)))];

    const lines = table(data, { hsep: "    " }).split("\n");
    const separatorWidth = Math.max(...lines.map(l => l.length));
    lines.splice(1, 0, "—".repeat(separatorWidth));

    return lines.join("\n");
};
