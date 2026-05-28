import AppIntents
import Foundation

struct OpenResidentSectionIntent: AppIntent {
    static let title: LocalizedStringResource = "Deschide sectiune Espace"
    static let description = IntentDescription("Deschide aplicatia Espace direct intr-o sectiune pentru locatar.")
    static let openAppWhenRun = true

    @Parameter(title: "Sectiune")
    var section: ResidentSectionIntentValue

    func perform() async throws -> some IntentResult {
        await MainActor.run {
            AppIntentRouter.shared.requestedTab = section.tab
        }
        return .result()
    }
}

struct CreateResidentRequestIntent: AppIntent {
    static let title: LocalizedStringResource = "Trimite cerere Espace"
    static let description = IntentDescription("Trimite rapid o cerere catre administratorul asociatiei.")
    static let openAppWhenRun = false

    @Parameter(title: "Titlu")
    var title: String

    @Parameter(title: "Descriere")
    var description: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let token = TokenStore.shared.loadToken() else {
            return .result(dialog: "Autentifica-te in Espace inainte de a trimite cereri.")
        }

        do {
            try await EspaceAPIClient.shared.createIssue(
                token: token,
                title: title,
                description: description
            )
            return .result(dialog: "Cererea a fost trimisa.")
        } catch {
            return .result(dialog: "Cererea nu a putut fi trimisa. Deschide Espace si incearca din nou.")
        }
    }
}

struct EspaceShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenResidentSectionIntent(),
            phrases: [
                "Deschide \(\.$section) in \(.applicationName)",
                "Arata \(\.$section) in \(.applicationName)"
            ],
            shortTitle: "Deschide sectiune",
            systemImageName: "square.grid.2x2"
        )

        AppShortcut(
            intent: CreateResidentRequestIntent(),
            phrases: [
                "Trimite cerere in \(.applicationName)"
            ],
            shortTitle: "Trimite cerere",
            systemImageName: "exclamationmark.bubble"
        )
    }
}
