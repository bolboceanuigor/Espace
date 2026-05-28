import SwiftUI

@main
struct EspaceApp: App {
    @State private var session = SessionStore(api: .shared, tokenStore: .shared)
    @State private var intentRouter = AppIntentRouter.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(intentRouter)
        }
    }
}
