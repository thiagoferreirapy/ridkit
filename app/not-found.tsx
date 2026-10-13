import { StorePage } from "@/components/pages";

// StorePage falls back to its "page not found" view for any path it does not know.
export default function NotFound() {
  return <StorePage path="/404" />;
}
