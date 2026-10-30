export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container flex h-14 items-center justify-between text-sm text-muted-foreground">
        <a href="https://codervent.com/" rel="noopener noreferrer" className="hover:underline">
         <span>
            © {new Date().getFullYear()}{" "}
            <span className="font-medium text-foreground">Cerulean</span>. All
            rights reserved.
          </span>
        </a>
        <span>
          Built with ❤️ by{" "}
          <span className="font-medium text-foreground"><a href="https://codervent.com/" rel="noopener noreferrer" className="hover:underline">Cerulean</a></span>
        </span>
      </div>
    </footer>
  )
}
