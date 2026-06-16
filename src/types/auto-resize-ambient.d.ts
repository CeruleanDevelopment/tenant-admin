declare module "@/components/AutoResizeTextarea" {
  import React from "react"
  const AutoResizeTextarea: React.ComponentType<any>
  export default AutoResizeTextarea
}

declare module "../../../../components" {
  import React from "react"
  export const AutoResizeTextarea: React.ComponentType<any>
}
