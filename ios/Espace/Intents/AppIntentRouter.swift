import AppIntents
import Observation

@MainActor
@Observable
final class AppIntentRouter {
    static let shared = AppIntentRouter()

    var requestedTab: AppTab?

    private init() {}
}

enum ResidentSectionIntentValue: String, AppEnum {
    case home
    case invoices
    case meters
    case requests
    case announcements

    static var typeDisplayName: LocalizedStringResource { "Sectiune Espace" }
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Sectiune Espace")

    static var caseDisplayRepresentations: [ResidentSectionIntentValue: DisplayRepresentation] {
        [
            .home: "Acasa",
            .invoices: "Facturi",
            .meters: "Contoare",
            .requests: "Cereri",
            .announcements: "Avizier"
        ]
    }

    var tab: AppTab {
        switch self {
        case .home: .home
        case .invoices: .invoices
        case .meters: .meters
        case .requests: .requests
        case .announcements: .announcements
        }
    }
}
