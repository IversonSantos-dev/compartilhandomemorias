import { createFileRoute } from "@tanstack/react-router";
import { MainCanvas } from "@/components/MainCanvas";

export const Route = createFileRoute("/")({
  component: MainCanvas,
});

