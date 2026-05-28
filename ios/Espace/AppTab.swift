import SwiftUI

enum AppTab: String, CaseIterable, Identifiable, Hashable {
    case home
    case invoices
    case meters
    case requests
    case announcements
    case account

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Acasa"
        case .invoices: "Facturi"
        case .meters: "Contoare"
        case .requests: "Cereri"
        case .announcements: "Avizier"
        case .account: "Cont"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .invoices: "doc.text"
        case .meters: "gauge.with.dots.needle.33percent"
        case .requests: "exclamationmark.bubble"
        case .announcements: "megaphone"
        case .account: "person.crop.circle"
        }
    }
}
