"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RevenueMonth = {
  month: string;
  revenue: string;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function RevenueChart({ data }: { data: RevenueMonth[] }) {
  const chartData = data.map((item) => ({
    month: item.month,
    revenue: Number(item.revenue),
  }));

  return (
    <div className="dashboard-chart" role="img" aria-label="Revenue by month bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="#e8eee9" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#66746d", fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#66746d", fontSize: 12 }}
            tickFormatter={(value: number) => currency.format(value)}
            width={82}
          />
          <Tooltip
            formatter={(value) => currency.format(Number(value))}
            labelFormatter={(label) => `Month: ${label}`}
            contentStyle={{ border: "1px solid #dfe7e1", borderRadius: "0.4rem" }}
          />
          <Bar dataKey="revenue" name="Revenue" fill="#28694f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
