import { bankMeta } from "@/lib/bank";
import HomeClient from "./HomeClient";

export const revalidate = 60;

export default async function Home() {
  return <HomeClient meta={await bankMeta()} />;
}
